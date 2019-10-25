import * as AdmZip from 'adm-zip';
import * as fs from 'fs-extra';
import * as klawSync from 'klaw-sync';

import { AuthGithub, BUILDER_CONFIG_NAME, OUTPUT_DIR, TEMP_DIR, WORKSPACE } from './config';
import exec, { ExecError } from './utils/exec';
import Queue from './utils/queue';
import StringUtil from './utils/StringUtil';

export class JobPool {
  private static pool = new Map<string, Job>();
  public static add(job: Job) {
    JobPool.pool.set(job.id, job);
  }
  public static get(jobId: string): Job {
    return JobPool.pool.get(jobId);
  }
  public static has(jobId: string) {
    return JobPool.pool.has(jobId);
  }
}
type JobStatus = 'preparing' | 'waiting' | 'building' | 'done' | 'failed';
interface JobConfig {
  package?: string
  pushToRelease?: boolean
}
export class Job {
  private _id: string;
  private _extraInfo: { [key: string]: string | number | boolean } = {};

  get id() { return this._id; }
  get extraInfo() { return this._extraInfo; }

  public status: JobStatus;

  public constructor() {
    fs.ensureDirSync(TEMP_DIR);
    let jobDir = fs.mkdtempSync(TEMP_DIR + '/');
    this._id = jobDir.substring(jobDir.lastIndexOf('/') + 1);
    this.status = 'preparing';
    this.attachInfo('startTimestamp', Date.now());
    JobPool.add(this);
  }

  public attachInfo(key: string, value: string | number | boolean) {
    this._extraInfo[key] = value;
  }
}

class BuildQueue {
  private static queue = new Queue<string>();
  public static push(jobId: string) {
    BuildQueue.queue.push(jobId);
    console.timeLog('Added job(' + jobId + ')');
    Builder.notify();
  }
  public static isEmpty() {
    return BuildQueue.queue.isEmpty();
  }
  public static pop() {
    return BuildQueue.queue.pop();
  }
}
export function pushBuildQueue(job: Job) {
  job.status = 'waiting';
  BuildQueue.push(job.id);
}

class Builder {
  private static builderAvailable = true;

  public static async notify() {
    if (Builder.builderAvailable && !BuildQueue.isEmpty()) {
      Builder.builderAvailable = false;
      let jobId = BuildQueue.pop();
      JobPool.get(jobId).status = 'building';
      Builder.buildJob(jobId);
    }
  }
  private static async buildJob(jobId: string) {
    try {
      await exec('cd ' + WORKSPACE + ' && git reset --hard HEAD && git clean -f -d');
      console.timeLog('Workspace cleaned');

      let job = JobPool.get(jobId);
      console.timeLog('Going to build job(' + jobId + ')');
      let config: JobConfig;
      if (fs.existsSync(TEMP_DIR + '/' + jobId + '/src/' + BUILDER_CONFIG_NAME)) {
        try {
          config = JSON.parse(fs.readJsonSync(TEMP_DIR + '/' + jobId + '/src/' + BUILDER_CONFIG_NAME));
        } catch (e) {
          throw new Error(`Cannot read ${BUILDER_CONFIG_NAME}`);
        }
      } else {
        config = {};
      }
      if (!('package' in config)) {
        try {
          config.package = await Builder.detectPackage(jobId);
        } catch (e2) {
          throw new Error(`Config does not contain a field package Failed auto detecting package info.`);
        }
      }
      let targetPath = WORKSPACE + '/appinventor/components/src/' + config.package.split('.').join('/') + '/';
      fs.ensureDirSync(targetPath);
      fs.emptyDirSync(targetPath);
      fs.copySync(TEMP_DIR + '/' + jobId + '/src/', targetPath);
      console.log('Copied: ' + targetPath);

      console.log('Compile started: job(' + jobId + ')');
      try {
        await exec('cd ' + WORKSPACE + '/appinventor && ant extensions', true);
      } catch (e) {
        e = <ExecError> e;
        // Notice that it would not work on windows
        let stdout = e.stdout.split(WORKSPACE).join('%SERVER_WORKSPACE%/');
        let stderr = e.stderr.split(WORKSPACE).join('%SERVER_WORKSPACE%/');
        throw new Error('Failed execute ant extensions: ' + e.message + ': code(' + e.code + ') stdout:\n' + stdout + '\n\nstderr:\n' + stderr);
      }

      let zip = new AdmZip();
      zip.addLocalFolder(WORKSPACE + '/appinventor/components/build/extensions');
      zip.addFile('build-info.json', new Buffer(JSON.stringify(job.extraInfo)));
      let zipPath = OUTPUT_DIR + '/' + jobId + '.zip';
      zip.writeZip(zipPath);

      JobPool.get(jobId).status = 'done';
      console.timeLog('Done job(' + jobId + '): ' + zipPath);

      if (job.extraInfo.isRelease === true || config.pushToRelease === true) {
        ResultReleaser.tryAttachToRelease(job);
      }

    } catch (e) {
      let err = <Error> e;
      JobPool.get(jobId).status = 'failed';
      let failInfo = err.name + ': ' + err.message;
      JobPool.get(jobId).attachInfo('failInfo', failInfo);
      console.log('Failed build job(' + jobId + '): ' + err);

    } finally {
      Builder.builderAvailable = true;
      Builder.notify();
    }
  }
  private static async detectPackage (jobId: string) {
    let pkg: string | null = null;
    klawSync(TEMP_DIR + '/' + jobId + '/src/', { nodir: true })
    .forEach(item => {
      if (pkg === null && item.path.endsWith('.java')) {
        let fileContent = fs.readFileSync(item.path, 'utf-8');
        fileContent = fileContent.trimLeft();
        fileContent = StringUtil.trimLeftComments(fileContent);
        let match = fileContent.match(/^package[ \n]+(?!\.)([\.\w\d]*[\w\d]);/i);
        if (match !== null) {
          pkg = match[1]; // 0 will be full match including 'package '
        }
      }
    });
    if (pkg === null) {
      throw new Error('No package info in found');
    } else {
      return pkg;
    }
  }
}

export class ResultReleaser {
  public static async tryAttachToRelease(job: Job) {
    let owner = <string> job.extraInfo.owner;
    let repo = <string> job.extraInfo.repo;
    let tag = <string> job.extraInfo.ref;
    let fullTagInfo = 'tag(' + tag + ') in repo(' + owner + '/' + repo + ')';

    if (!owner || !repo || !tag) {
      console.log('Failed release build result, repo info is imcompleted.');
      return;
    }

    let github = AuthGithub();

    let releaseUrlResult;
    try {
      releaseUrlResult = await github.repos.getReleaseByTag({ owner, repo, tag });
    } catch (e) {
      console.log('Failed finding ' + fullTagInfo);
      return;
    }

    let name = 'binary.zip';
    let label = 'Auto-Build result by extension-builder';
    let file = fs.readFileSync(OUTPUT_DIR + '/' + job.id + '.zip');
    try {
      await github.repos.uploadReleaseAsset({
        headers: {
          'content-length': file.length,
          'content-type': 'application/zip'
        },
        url: releaseUrlResult.data.upload_url,
        name, label, file 
      });
    } catch (e) {
      let err = <HttpError> e;
      if (err.status == 404) {
        console.log('Failed upload binary to ' + fullTagInfo + ', may because authorization failed or permission not granted.');
      } else if (err.status == 422) {
        console.log('Failed upload binary to ' + fullTagInfo + ', may because asset had been uploaded.');
      }
    }
  }
}

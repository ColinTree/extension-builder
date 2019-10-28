import * as AdmZip from 'adm-zip';
import * as fs from 'fs-extra';
import * as klawSync from 'klaw-sync';
import BuildQueue from './BuildQueue.class';
import { AuthGithub, BUILDER_CONFIG_NAME, OUTPUT_DIR, TEMP_DIR, WORKSPACE } from './configs';
import Job, { JobConfig } from './Job.class';
import JobPool from './JobPool.class';
import exec, { ExecError } from './utils/exec';
import StringUtil from './utils/StringUtil.class';

export default class Builder {

  public static async notify () {
    if (Builder.builderAvailable && !BuildQueue.isEmpty()) {
      Builder.builderAvailable = false;
      const jobId = BuildQueue.dequeue();
      JobPool.get(jobId).status = 'building';
      Builder.buildJob(jobId);
    }
  }

  private static builderAvailable = true;

  private static async buildJob (jobId: string) {
    try {
      await exec(`cd ${WORKSPACE} && git reset --hard HEAD && git clean -f -d`);
      console.timeLog('Workspace cleaned');

      const job = JobPool.get(jobId);
      console.timeLog(`Going to build job(${jobId})`);
      const configFileName = `${TEMP_DIR}/${jobId}/src/${BUILDER_CONFIG_NAME}`;
      let config: JobConfig;
      if (fs.existsSync(configFileName)) {
        try {
          config = fs.readJsonSync(configFileName);
        } catch (e) {
          throw new Error(`Cannot read ${configFileName}: ${e}`);
        }
      } else {
        config = {};
      }
      if (!('package' in config)) {
        try {
          config.package = await Builder.detectPackage(jobId);
        } catch (e2) {
          throw new Error(`Config does not contain a field package failed auto detecting package info.`);
        }
      }
      const targetPath = WORKSPACE + '/appinventor/components/src/' + config.package.split('.').join('/') + '/';
      fs.ensureDirSync(targetPath);
      fs.emptyDirSync(targetPath);
      fs.copySync(TEMP_DIR + '/' + jobId + '/src/', targetPath);
      console.log(`Copied: ${targetPath}`);

      console.log(`Compile started: job(${jobId})`);
      try {
        await exec(`cd ${WORKSPACE}/appinventor && ant extensions`, true);
      } catch (e) {
        e = e as ExecError;
        // Notice that it would not work on windows
        const stdout = e.stdout.split(WORKSPACE).join('%SERVER_WORKSPACE%/');
        const stderr = e.stderr.split(WORKSPACE).join('%SERVER_WORKSPACE%/');
        throw new Error(`Failed execute ant extensions: ${e.message}: code(${e.code})`
          + `stdout:\n${stdout}\n\nstderr:\n${stderr}`);
      }

      const zip = new AdmZip();
      zip.addLocalFolder(`${WORKSPACE}/appinventor/components/build/extensions`);
      zip.addFile('build-info.json', new Buffer(JSON.stringify(job.extraInfo)));
      const zipPath = `${OUTPUT_DIR}/${jobId}.zip`;
      zip.writeZip(zipPath);

      JobPool.get(jobId).status = 'done';
      console.timeLog(`Done job(${jobId}): ${zipPath}`);

      if (job.extraInfo.isRelease === true || config.pushToRelease === true) {
        this.tryAttachToRelease(job);
      }

    } catch (e) {
      const err = e as Error;
      JobPool.get(jobId).status = 'failed';
      const failInfo = err.name + ': ' + err.message;
      JobPool.get(jobId).attachInfo('failInfo', failInfo);
      console.log(`Failed build job(${jobId}): ${err}`);

    } finally {
      Builder.builderAvailable = true;
      Builder.notify();
    }
  }
  private static async detectPackage (jobId: string) {
    let pkg: string | null = null;
    klawSync(`${TEMP_DIR}/${jobId}/src/`, { nodir: true })
    .forEach(item => {
      if (pkg === null && item.path.endsWith('.java')) {
        let fileContent = fs.readFileSync(item.path, 'utf-8');
        fileContent = fileContent.trimLeft();
        fileContent = StringUtil.trimLeftComments(fileContent);
        const match = fileContent.match(/^package[ \n]+(?!\.)([\.\w\d]*[\w\d]);/i);
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

  private static async tryAttachToRelease (job: Job) {
    const owner = job.extraInfo.owner as string;
    const repo = job.extraInfo.repo as string;
    const tag = job.extraInfo.ref as string;
    const fullTagInfo = `tag(${tag}) in repo(${owner}/${repo})`;

    if (!owner || !repo || !tag) {
      console.log('Failed release build result, repo info is imcompleted.');
      return;
    }

    const github = AuthGithub();

    let releaseUrlResult;
    try {
      releaseUrlResult = await github.repos.getReleaseByTag({ owner, repo, tag });
    } catch (e) {
      console.log('Failed finding ' + fullTagInfo);
      return;
    }

    const name = 'binary.zip';
    const label = 'Auto-Build result by extension-builder';
    const file = fs.readFileSync(OUTPUT_DIR + '/' + job.id + '.zip');
    try {
      await github.repos.uploadReleaseAsset({
        headers: {
          'content-length': file.length,
          'content-type': 'application/zip',
        },
        url: releaseUrlResult.data.upload_url,
        name, label, file,
      });
    } catch (e) {
      if (e.status === 404) {
        console.log(`Failed upload binary to ${fullTagInfo}: authorization failed or permission not granted.`);
      } else if (e.status === 422) {
        console.log(`Failed upload binary to ${fullTagInfo}: asset with same name exists under the release.`);
      }
    }
  }
}

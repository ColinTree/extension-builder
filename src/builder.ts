import * as fs from "fs-extra";
import * as AdmZip from "adm-zip"

import exec from "./utils/exec";
import { WORKSPACE, TEMP_DIR, BUILDER_CONFIG_NAME, OUTPUT_DIR } from "./config";
import Queue from "./utils/queue";

class BuildQueue extends Queue<string> {
  constructor() { super(); }
  public push(jobId: string) {
    super.push(jobId);
    console.timeLog("Added job(" + jobId + ")");
    Builder.notify();
  }
}
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
const buildQueue = new BuildQueue();

export function addBuildQueue(job: Job) {
  console.timeLog("Job(" + job.id + ") going to be added into build queue");
  // job will be added to build queue by itself after it is ready (in constructor)
  job.status = JobStatus.waiting;
  buildQueue.push(job.id);
}

export enum BuildType {
  "github-repo" = "github-repo",
  "source-upload" = "source-upload"
}
export enum JobStatus {
  preparing = "preparing",
  waiting = "waiting",
  building = "building",
  done = "done",
  failed = "failed"
}
export class Job {
  private _id: string;
  private _extraInfo: { [key: string]: string | number } = {};

  get id() { return this._id; }
  get extraInfo() { return this._extraInfo; }

  public status: JobStatus;

  public constructor() {
    // fs.mkdtempSync(TEMP_DIR) => {TEMP_DIR}/{jobId}
    let jobDir = fs.mkdtempSync(TEMP_DIR + "/");
    this._id = jobDir.substring(jobDir.lastIndexOf("/") + 1);
    this._extraInfo.startTimestamp = Date.now();
    this.status = JobStatus.preparing;
    JobPool.add(this);
  }

  public attachInfo(key: string, value: string | number) {
    this._extraInfo[key] = value;
  }
}

class Builder {
  private static builderAvailable = true;

  public static notify() {
    if (Builder.builderAvailable && !buildQueue.isEmpty()) {
      Builder.builderAvailable = false;
      let jobId = buildQueue.pop();
      JobPool.get(jobId).status = JobStatus.building;
      Builder.cleanWorkspace()
      .then(() => Builder.buildJob(jobId));
    }
  }
  private static cleanWorkspace() {
    return new Promise<void>(resolve => {
      exec("cd " + WORKSPACE + " && git reset --hard HEAD && git clean -f")
      .then(stdout => {
        console.timeLog("Workspace cleaned");
        resolve();
      });
    })
  }
  private static buildJob(jobId: string) {
    return new Promise<void>(resolve => {
      let job = JobPool.get(jobId);
      console.timeLog("Going to build job(" + jobId + ")");
      let config = JSON.parse(fs.readFileSync(TEMP_DIR + "/" + jobId + "/src/" + BUILDER_CONFIG_NAME, "utf8"));
      let targetPath = WORKSPACE + "/appinventor/components/src/" + config.package.split(".").join("/") + "/";
      fs.ensureDirSync(targetPath);
      fs.emptyDirSync(targetPath);
      fs.copySync(TEMP_DIR + "/" + jobId + "/src/", targetPath);
      console.log("Copied: " + targetPath);
      console.log("Compile started: job(" + jobId + ")");
      exec("cd " + WORKSPACE + "/appinventor && ant extensions", true)
      .then(stdout => {
        let zip = new AdmZip();
        zip.addLocalFolder(WORKSPACE + "/appinventor/components/build/extensions");
        zip.addFile("build-info.json", new Buffer(JSON.stringify(job.extraInfo)));
        let zipPath = OUTPUT_DIR + "/" + jobId + ".zip";
        zip.writeZip(zipPath);
        JobPool.get(jobId).status = JobStatus.done;
        console.log("Done job(" + jobId + "): " + zipPath);
        Builder.builderAvailable = true;
        Builder.notify();
        resolve();
      })
      .catch(reason => {
        JobPool.get(jobId).status = JobStatus.failed;
        console.log("Job(" + jobId + ") build failed", reason);
        Builder.builderAvailable = true;
        Builder.notify();
      });
    });
  }
}
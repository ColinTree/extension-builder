import * as fs from "fs-extra";
import * as AdmZip from "adm-zip"

import exec, { ExecError } from "./utils/exec";
import { WORKSPACE, TEMP_DIR, BUILDER_CONFIG_NAME, OUTPUT_DIR } from "./config";
import Queue from "./utils/queue";

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
type JobStatus = "preparing" | "waiting" | "building" | "done" | "failed";
export class Job {
  private _id: string;
  private _extraInfo: { [key: string]: string | number } = {};

  get id() { return this._id; }
  get extraInfo() { return this._extraInfo; }

  public status: JobStatus;

  public constructor() {
    fs.ensureDirSync(TEMP_DIR);
    let jobDir = fs.mkdtempSync(TEMP_DIR + "/");
    this._id = jobDir.substring(jobDir.lastIndexOf("/") + 1);
    this.status = "preparing";
    this.attachInfo("startTimestamp", Date.now());
    JobPool.add(this);
  }

  public attachInfo(key: string, value: string | number) {
    this._extraInfo[key] = value;
  }
}

class BuildQueue {
  private static queue = new Queue<string>();
  public static push(jobId: string) {
    BuildQueue.queue.push(jobId);
    console.timeLog("Added job(" + jobId + ")");
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
  job.status = "waiting";
  BuildQueue.push(job.id);
}

class Builder {
  private static builderAvailable = true;

  public static async notify() {
    if (Builder.builderAvailable && !BuildQueue.isEmpty()) {
      Builder.builderAvailable = false;
      let jobId = BuildQueue.pop();
      JobPool.get(jobId).status = "building";
      Builder.buildJob(jobId);
    }
  }
  private static async buildJob(jobId: string) {
    await exec("cd " + WORKSPACE + " && git reset --hard HEAD && git clean -f");
    console.timeLog("Workspace cleaned");

    let job = JobPool.get(jobId);
    console.timeLog("Going to build job(" + jobId + ")");
    let config = JSON.parse(fs.readFileSync(TEMP_DIR + "/" + jobId + "/src/" + BUILDER_CONFIG_NAME, "utf8"));
    let targetPath = WORKSPACE + "/appinventor/components/src/" + config.package.split(".").join("/") + "/";
    fs.ensureDirSync(targetPath);
    fs.emptyDirSync(targetPath);
    fs.copySync(TEMP_DIR + "/" + jobId + "/src/", targetPath);
    console.log("Copied: " + targetPath);

    console.log("Compile started: job(" + jobId + ")");
    try {
      await exec("cd " + WORKSPACE + "/appinventor && ant extensions", true);
    } catch (e) {
      e = <ExecError> e;
      JobPool.get(jobId).status = "failed";
      // Notice that it would not work on windows
      let stdout = e.stdout.split(WORKSPACE).join("%SERVER_WORKSPACE%/");
      let stderr = e.stderr.split(WORKSPACE).join("%SERVER_WORKSPACE%/");
      JobPool.get(jobId).attachInfo("failInfo",
          e.message + ": code(" + e.code + ") stdout:\n" + stdout + "\n\nstderr:\n" + stderr);
      console.log("Job(" + jobId + ") build failed in part of `ant extensions`");
      Builder.builderAvailable = true;
      Builder.notify();
    }

    let zip = new AdmZip();
    zip.addLocalFolder(WORKSPACE + "/appinventor/components/build/extensions");
    zip.addFile("build-info.json", new Buffer(JSON.stringify(job.extraInfo)));
    let zipPath = OUTPUT_DIR + "/" + jobId + ".zip";
    zip.writeZip(zipPath);

    JobPool.get(jobId).status = "done";
    console.log("Done job(" + jobId + "): " + zipPath);

    Builder.builderAvailable = true;
    Builder.notify();
  }
}
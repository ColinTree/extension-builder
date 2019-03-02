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
  public static add(jobId: string, job: Job) {
    JobPool.pool.set(jobId, job);
  }
  public static get(jobId: string): Job {
    return JobPool.pool.get(jobId);
  }
  public static has(jobId: string) {
    return JobPool.pool.has(jobId);
  }
}
const buildQueue = new BuildQueue();

export function addBuildQueue(jobId: string) {
  console.timeLog("Job(" + jobId + ") going to be added into build queue");
  // job will be added to build queue by itself after it is ready (in constructor)
  JobPool.add(jobId, new Job(jobId));
}

interface JobConfig {
  package: string
}
class Job {
  private _id: string;
  private _config: JobConfig;

  get id() { return this._id; }
  get config() { return this._config; }

  public status: "waiting" | "building" | "done" | "failed";

  public constructor(jobId: string) {
    this._id = jobId;
    this.status = "waiting";
    this.loadConfig()
    .then(config => {
      this._config = config;
      buildQueue.push(jobId);
    });
  }
  private loadConfig() {
    return new Promise<JobConfig>(resolve => {
      fs.readFile(TEMP_DIR + "/" + this.id + "/src/" + BUILDER_CONFIG_NAME,
                  "utf8", (err, data) => {
        if (err) throw err;
        resolve(JSON.parse(data));
      });
    });
  }
}

class Builder {
  private static builderAvailable = true;

  public static notify() {
    if (Builder.builderAvailable && !buildQueue.isEmpty()) {
      Builder.builderAvailable = false;
      let jobId = buildQueue.pop();
      JobPool.get(jobId).status = "building";
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
      let config = job.config;
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
        let zipPath = OUTPUT_DIR + "/" + jobId + ".zip";
        zip.writeZip(zipPath);
        JobPool.get(jobId).status = "done";
        console.log("Done job(" + jobId + "): " + zipPath);
        Builder.builderAvailable = true;
        Builder.notify();
        resolve();
      })
      .catch(reason => {
        JobPool.get(jobId).status = "failed";
        console.log("Job(" + jobId + ") build failed", reason);
        Builder.builderAvailable = true;
        Builder.notify();
      });
    });
  }
}
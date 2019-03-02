import * as fs from "fs-extra";

import exec from "./utils/exec";
import { WORKSPACE, TEMP_DIR, MULTI_EXTENSION_BUILDING, BUILDER_CONFIG_NAME, OUTPUT_DIR } from "./config";
import Queue from "./utils/queue";

class BuildQueue extends Queue<string> {
  constructor() { super(); }
  public push(jobId: string) {
    super.push(jobId);
    console.timeLog("Added", jobId);
    Builder.notify();
  }
}
class JobPool {
  private static pool = new Map<string, Job>();
  public static add(jobId: string, job: Job) {
    JobPool.pool.set(jobId, job);
  }
  public static get(jobId: string): Job {
    return JobPool.get(jobId);
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
  public _status: "waiting" | "building" | "done";

  get id() { return this._id; }
  get config() { return this._config; }

  public constructor(jobId: string) {
    this._id = jobId;
    this._status = "waiting";
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
      if (MULTI_EXTENSION_BUILDING) {
        console.error("Builder in wrong mode! multi-extension building is not implemented yet.");
        // TODO: multi-extension building
      } else {
        let jobId = buildQueue.pop();
        JobPool.get(jobId)._status = "building";
        Builder.cleanWorkspace()
        .then(() => Builder.buildJob(jobId));
      }
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
      console.timeLog("Going to copy job(" + jobId + ")");
      let config = job.config;
      let targetPath = WORKSPACE + "/appinventor/components/src/" + config.package.split(".").join("/") + "/";
      fs.ensureDirSync(targetPath);
      fs.emptyDirSync(targetPath);
      fs.copySync(TEMP_DIR + "/" + jobId + "/src/", targetPath);
      console.timeLog("Copied: " + targetPath);
      console.timeLog("Compile started: job(" + jobId + ")");
      exec("cd " + WORKSPACE + "/appinventor && ant extensions", true)
      .then(stdout => {
        let jobOutputDir = OUTPUT_DIR + "/" + jobId
        fs.ensureDirSync(jobOutputDir);
        fs.emptyDirSync(jobOutputDir);
        fs.copySync(WORKSPACE + "/appinventor/components/build/extensions", jobOutputDir);
        JobPool.get(jobId)._status = "done";
        console.timeLog("Done job(" + jobId + "): " + jobOutputDir);
        Builder.builderAvailable = true;
        Builder.notify();
        resolve();
      })
      .catch(reason => {
        console.timeLog("Job(" + jobId + ") build failed", reason);
      });
    });
  }
}
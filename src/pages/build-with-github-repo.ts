import * as fs from "fs-extra";
import * as Admzip from "adm-zip";
import * as Github from "@octokit/rest";

import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { ENABLE_REPO_WHITELIST, TEMP_DIR, inWhitelist } from "../config";
import { responseSuccess, responseError } from "../index";
import { addBuildQueue, Job, JobPool, BuildType, JobStatus } from "../builder";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  if (request.method == "GET") {
    let owner = params.get("owner");
    let repoName = params.get("repoName");
    let ref = params.has("ref") ? params.get("ref") : "master";
    console.timeLog("Job info received: repo= " + owner + "/" + repoName + " ref= " + ref);
    if (!ENABLE_REPO_WHITELIST || inWhitelist(owner, repoName, ref)) {
      startGithubJob(response, owner, repoName, ref);
      return;
    } else {
      responseError(response, 403, "Whitelist is enabled & your repo (or ref) is not in it.");
      return;
    }

  } else if (request.method == "POST") {
    // webhook
    let indexOfEvent = request.rawHeaders.indexOf("X-GitHub-Event");
    let event: string;
    if (indexOfEvent != -1 && (indexOfEvent + 1) < request.rawHeaders.length) {
      event = request.rawHeaders[indexOfEvent + 1];
    }
    console.log("Github event = " + event);
    if (!["push", "release"].includes(event)) {
      responseError(response, 403, "Does not support event type: " + event);
      return;
    }
    let content = "";
    request.on("data", chunk => {
      content += chunk;
    });
    request.on("end", () => {
      let playload = JSON.parse(content);
      let commitOrTag: string;
      switch (event) {
        case "push":
          commitOrTag = playload.head_commit.id;
          break;
        case "release":
          commitOrTag = playload.release.tag_name;
          break;
      }
      let owner = playload.repository.owner.login;
      let repoName = playload.repository.name;
      console.log("Repo = " + owner + "/" + repoName + " commitOrTag = " + commitOrTag);
      if (typeof(owner)!="string" || typeof(repoName)!="string" || commitOrTag) {
        responseError(response, 403, "Cannot be built, at least one of owner, repoName or commit is not string.");
        return;
      }
      if (!ENABLE_REPO_WHITELIST || inWhitelist(owner, repoName)) {
        startGithubJob(response, owner, repoName, commitOrTag);
        return;
      } else {
        responseError(response, 403, "Whitelist is enabled & your repo is not in it.");
        return;
      }
    });
  }
}

function startGithubJob(response: ServerResponse, owner: string, repoName: string, ref: string) {
  let job = new Job();
  let jobId = job.id;

  job.attachInfo("buildType", BuildType["github-repo"]);
  job.attachInfo("owner", owner);
  job.attachInfo("repoName", repoName);
  job.attachInfo("ref", ref);

  responseSuccess(response, {
    msg: "Job added.",
    jobId: jobId
  });

  // Downlaod archieve
  new Github().repos.getArchiveLink({
    owner: owner,
    repo: repoName,
    archive_format: "zipball",
    ref: ref
  })
  .then(archieveResponse => new Promise<string>((resolve, reject) => {
    let zip = new Admzip(<Buffer> archieveResponse.data);
    if (zip.getEntries().length == 0) {
      reject("No source found in archieve downloaded.");
      return;
    }
    let entryDir = zip.getEntries()[0].entryName;
    zip.extractAllTo(TEMP_DIR + "/" + jobId + "/rawComponentSource/");
    fs.moveSync(TEMP_DIR + "/" + jobId + "/rawComponentSource/" + entryDir,
                TEMP_DIR + "/" + jobId + "/src");
    fs.rmdirSync(TEMP_DIR + "/" + jobId + "/rawComponentSource");
    console.timeLog("Source extracted to " + TEMP_DIR + "/" + jobId + "/src");
    addBuildQueue(job);
  }))
  .catch(reason => {
    JobPool.get(jobId).status = JobStatus.failed;
    if (Object.getPrototypeOf(reason) == Error.prototype) {
      let err = <Error> reason;
      JobPool.get(jobId).attachInfo("failInfo",
          err.name == "HttpError"
          ? "Cannot load source from github, please check if the ref exists in the specified repo."
          : err.message);
    } else {
      JobPool.get(jobId).attachInfo("failInfo", reason.toString());
    }
    console.log("Fail prepare source of job(" + jobId + ")", reason);
  });
}
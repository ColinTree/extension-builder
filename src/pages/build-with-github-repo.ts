import * as fs from "fs-extra";
import * as Admzip from "adm-zip";
import * as Github from "@octokit/rest";

import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { ENABLE_REPO_WHITELIST, TEMP_DIR, inWhitelist } from "../config";
import { responseSuccess, responseError } from "../index";
import { pushBuildQueue, Job, JobPool } from "../builder";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  if (request.method == "GET") {
    let owner = params.get("owner");
    let repo = params.get("repo");
    let ref = params.has("ref") ? params.get("ref") : "master";
    console.timeLog("Job info received: repo= " + owner + "/" + repo + " ref= " + ref);
    if (!ENABLE_REPO_WHITELIST || inWhitelist(owner, repo, ref)) {
      startGithubJob(response, owner, repo, ref);
      return;
    } else {
      responseError(response, 403, "Whitelist is enabled & your repo (or ref) is not in it.");
      return;
    }

  } else if (request.method == "POST") { // webhook
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
      if (event == "push" && playload.ref.indexOf("/refs/heads/") == -1) {
        responseSuccess(response, "Build ignored since this is not a push of /refs/heads/");
        return;
      }
      let commitOrTag: string;
      if (event == "push") {
        commitOrTag = playload.head_commit.id;
      } else if (event == "release") {
        commitOrTag = playload.release.tag_name;
      }
      let owner = playload.repository.owner.login;
      let repo = playload.repository.name;
      console.log("Repo = " + owner + "/" + repo + " commitOrTag = " + commitOrTag);
      if (typeof(owner)!="string" || typeof(repo)!="string" || typeof(commitOrTag)!="string") {
        responseError(response, 403, "Cannot be built, at least one of owner, repo or commit is not string.");
        return;
      }
      if (!ENABLE_REPO_WHITELIST || inWhitelist(owner, repo)) {
        startGithubJob(response, owner, repo, commitOrTag, event == "release");
        return;
      } else {
        responseError(response, 403, "Whitelist is enabled & your repo is not in it.");
        return;
      }
    });
  }
}

async function startGithubJob(response: ServerResponse, owner: string, repo: string, ref: string, isRelease = false) {
  let job = new Job();
  let jobId = job.id;

  job.attachInfo("buildType", "github-repo");
  job.attachInfo("owner", owner);
  job.attachInfo("repo", repo);
  job.attachInfo("ref", ref);
  job.attachInfo("isRelease", isRelease);

  responseSuccess(response, {
    msg: "Job added.",
    jobId: jobId
  });

  // Downlaod archive
  let archiveResponse: Github.Response<Github.ReposGetArchiveLinkResponse>;
  try {
    archiveResponse = await new Github().repos.getArchiveLink({ owner, repo, ref, archive_format: "zipball" });
  } catch (e) {
    JobPool.get(jobId).status = "failed";
    JobPool.get(jobId).attachInfo("failInfo", "Cannot load source from github, please check if the ref or repo exists.");
    console.log("Fail prepare source of job(" + jobId + ")", e);
    return;
  }

  // Extract responding archive
  let zip = new Admzip(<Buffer> archiveResponse.data);
  if (zip.getEntries().length == 0) {
    throw "No source found in archive downloaded.";
  }
  let entryDir = zip.getEntries()[0].entryName;
  zip.extractAllTo(TEMP_DIR + "/" + jobId + "/rawComponentSource/");
  fs.moveSync(TEMP_DIR + "/" + jobId + "/rawComponentSource/" + entryDir,
              TEMP_DIR + "/" + jobId + "/src");
  fs.rmdirSync(TEMP_DIR + "/" + jobId + "/rawComponentSource");
  console.timeLog("Source extracted to " + TEMP_DIR + "/" + jobId + "/src");

  pushBuildQueue(job);
}
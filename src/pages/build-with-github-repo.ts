import * as https from "https";
import * as fs from "fs-extra";
import * as Admzip from "adm-zip";

import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { ENABLE_REPO_WHITELIST, TEMP_DIR, inWhitelist } from "../config";
import { responseSuccess, responseError } from "../index";
import { addBuildQueue, Job } from "../builder";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  if (request.method == "GET") {
    let owner = params.get("owner");
    let repoName = params.get("repoName");
    let codeNode = params.has("codeNode") ? params.get("codeNode") : "master";
    console.timeLog("Job info received: repo= " + owner + "/" + repoName + " codeNode= " + codeNode);
    if (!ENABLE_REPO_WHITELIST || inWhitelist(owner, repoName, codeNode)) {
      startGithubJob(response, owner, repoName, codeNode);
      return;
    } else {
      responseError(response, 403, "Whitelist is enabled & your repo (or codeNode) is not in it.");
      return;
    }

  } else if (request.method == "POST") {
    // webhook
    let event = <string> request.headers["X-GitHub-Event"];
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
          commitOrTag = playload.head_commit;
          break;
        case "release":
          commitOrTag = playload.release.tag_name;
          break;
      }
      let owner = playload.repository.owner.name;
      let repoName = playload.repository.name;
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

function startGithubJob(response: ServerResponse, owner: string, repoName: string, codeNode: string) {
  let jobId = Job.generateJobId();
  responseSuccess(response, {
    msg: "Build started.",
    jobId: jobId
  });
  getZip(jobId, owner, repoName, codeNode)
  .then(zipName => prepareSource(jobId, zipName))
  .then(() => addBuildQueue(jobId))
  .catch(reason => {
    console.error(reason);
  });
}

function getZip(jobId: string, owner: string, repoName: string, codeNode: string) {
  return new Promise<string>(resolve => {
    // https://github.com/{owner}/{repoName}/archive/{codeNode}.zip
    // redirecting to -> https://codeload.github.com/{owner}/{repoName}/zip/{codeNode}
    let requestUrl = "https://codeload.github.com/" + owner + "/" + repoName + "/zip/" + codeNode;
    let zipName = owner + "_" + repoName + "_" + codeNode;
    let destZipPath = TEMP_DIR + "/" + jobId + "/" + zipName + ".zip";
    https.get(requestUrl, response => {
      var stream = response.pipe(fs.createWriteStream(destZipPath));
      stream.on("finish", () => {
        console.timeLog("Downloaded: " + destZipPath);
        resolve(zipName);
      });
    });
  });
}

function prepareSource(jobId: string, zipPath: string) {
  return new Promise<void>(resolve => {
    let zip = new Admzip(TEMP_DIR + "/" + jobId + "/" + zipPath + ".zip");
    let entryDir: string;
    zip.getEntries().forEach(entry => {
      if (!entryDir) {
        entryDir = entry.entryName;
      }
    });
    zip.extractEntryTo(entryDir, TEMP_DIR + "/" + jobId + "/rawComponentSource/");
    fs.moveSync(TEMP_DIR + "/" + jobId + "/rawComponentSource/" + entryDir,
                TEMP_DIR + "/" + jobId + "/src");
    fs.rmdirSync(TEMP_DIR + "/" + jobId + "/rawComponentSource");
    console.timeLog("Unzipped & moved to " + TEMP_DIR + "/" + jobId + "/src");
    resolve();
  });
}
import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";
import * as https from "https";
import * as fs from "fs-extra";
import * as Admzip from "adm-zip";

import { ENABLE_REPO_WHITELIST, TEMP_DIR, inWhitelist } from "../config";
import { responseSuccess, responseError } from "../index";
import { addBuildQueue } from "../builder";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  if (request.method == "GET") {
    let owner = params.get("owner");
    let repoName = params.get("repoName");
    let branch = params.has("branch") ? params.get("branch") : "master";

    console.timeLog("Job info received: repo= " + owner + "/" + repoName + " branch= " + branch);

    if (!ENABLE_REPO_WHITELIST || inWhitelist(owner, repoName, branch)) {
      // 1. white list is not enabled
      // 2. is in the white list

      // fs.mkdtempSync(TEMP_DIR) => {TEMP_DIR}/{jobId}
      let jobId = fs.mkdtempSync(TEMP_DIR + "/");
      jobId = jobId.substring(jobId.lastIndexOf("/") + 1);

      responseSuccess(response, {
        msg: "Build started.",
        jobId: jobId
      });

      getZip(jobId, owner, repoName, branch)
      .then(zipName => prepareSource(jobId, zipName))
      .then(() => addBuildQueue(jobId))
      .catch(reason => {
        console.error(reason);
      });
      return;
    } else {
      responseError(response, 403, "Whitelist is enabled & your repo is not in it.");
      return;
    }

  } else if (request.method == "POST") {
    // webhook
    let content = "";

    request.on("data", chunk => {
      content += chunk;
    });

    request.on("end", () => {
      responseSuccess(response, { content: content });
    });
    return;
  }
}

function getZip(jobId: string, owner: string, repoName: string, branch: string) {
  return new Promise<string>(resolve => {
    // https://github.com/{owner}/{repoName}/archive/{branch}.zip
    // redirecting to -> https://codeload.github.com/{owner}/{repoName}/zip/{branch}
    let requestUrl = "https://codeload.github.com/" + owner + "/" + repoName + "/zip/" + branch;
    let zipName = owner + "_" + repoName + "_" + branch;
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
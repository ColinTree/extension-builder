import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";
import * as https from "https";
import * as fs from "fs-extra";
import * as Admzip from "adm-zip";

import { AI_WORKSPACE, ENABLE_REPO_WHITELIST, TEMP_DIR, inWhitelist } from "../config";
import { CONTENT_TYPE_JSON, responseError } from "../index";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  if (request.method == "GET") {
    let owner = params.get("owner");
    let repoName = params.get("repoName");
    let branch = params.has("branch") ? params.get("branch") : "master";

    console.log("repo= " + owner + "/" + repoName + " branch=" + branch);

    if (!ENABLE_REPO_WHITELIST || inWhitelist(owner, repoName, branch)) {
      // 1. white list is not enabled
      // 2. is in the white list
      let jobId = fs.mkdtempSync(TEMP_DIR);
      if (jobId.charAt(jobId.length - 1) == "/") {
        jobId = jobId.substr(0, jobId.length - 1);
      }
      jobId = jobId.substring(jobId.lastIndexOf("/") + 1);

      response.writeHead(200, CONTENT_TYPE_JSON);
      response.end(JSON.stringify({
        status: "success",
        msg: "Build started.",
        jobId: jobId
      }));

      getZip(owner, repoName, branch, jobId)
      .then((path: string) =>
          unZip(path))
      .then((componentSourcePath: string) =>
          prepareComponentSource(componentSourcePath))
      .then(componentInfo => {
        console.log("Currently, that's all~");
      })
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
  
    request.on('data', chunk => {
      content += chunk;
    });
  
    request.on('end', () => {
      response.writeHead(200, {"Content-Type": "text/plain"});
      response.write(content);
      response.end();
    });
    return;
  }
}

function getZip(owner: string, repoName: string, branch: string, jobId: string) {
  return new Promise((resolve, reject) => {
    // https://github.com/{owner}/{repoName}/archive/{branch}.zip
    // redirecting to -> https://codeload.github.com/{owner}/{repoName}/zip/{branch}
    let requestUrl = "https://codeload.github.com/" + owner + "/" + repoName + "/zip/" + branch;
    let destPath = TEMP_DIR + jobId + "/" + owner + "_" + repoName + "_" + branch + ".zip";
    https.get(requestUrl, response => {
      var stream = response.pipe(fs.createWriteStream(destPath));
      stream.on("finish", () => {
        console.log("downloaded: " + destPath);
        resolve(destPath);
      });
    });
  });
}

function unZip(zipPath: string) {
  return new Promise(resolve => {
    let tarPath = zipPath.substring(0, zipPath.lastIndexOf(".zip"));
    let zip = new Admzip(zipPath);
    let entryDir: string;
    zip.getEntries().forEach(entry => {
      if (!entryDir) {
        entryDir = entry.entryName;
      }
    });
    zip.extractEntryTo(entryDir, tarPath);
    console.log("unzipped: " + tarPath);
    resolve(tarPath + "/" + entryDir);
  });
}

function prepareComponentSource(sourcePath: string) {
  return new Promise(resolve => {
    let config = JSON.parse(fs.readFileSync(sourcePath + "/builder-config.json", "utf8"));
    let packagePath: string = config.package;
    packagePath = packagePath.split(".").join("/");
    let targetPath = AI_WORKSPACE + "/appinventor/components/src/" + packagePath + "/";
    fs.ensureDirSync(targetPath);
    fs.emptyDirSync(targetPath);
    fs.copySync(sourcePath, targetPath);
    console.log("copied: " + targetPath);
    resolve();
  });
}
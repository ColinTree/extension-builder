import * as http from "http";
import * as url from "url";
import * as fs from "fs-extra";

import { PORT, TEMP_DIR, EMPTY_TEMP_DIR_BEFORE_BUILD } from "./config";
import handleBuildWithGithubRepo from "./pages/build-with-github-repo";
import handleBuildWithZip from "./pages/build-with-zip";
import handleCheckStatus from "./pages/check-status";

export const CONTENT_TYPE_JSON = {"Content-Type": "application/json"};
export function responseSuccess(response: http.ServerResponse, info: {}) {
  response.writeHead(200, CONTENT_TYPE_JSON);
  response.end(JSON.stringify(info));
}
export function responseError(response: http.ServerResponse, code: number, msg: string) {
  response.writeHead(code, CONTENT_TYPE_JSON);
  response.end(JSON.stringify({ msg: msg }));
}

function startServer() {
  let server = http.createServer((request, response) => {
    try {
      let requestUrl = url.parse(request.url);
      let params = new url.URLSearchParams(requestUrl.query);
      console.timeLog("processing request: " + request.url);
      switch (requestUrl.pathname) {
        case "/build-with-github-repo":
          handleBuildWithGithubRepo(request, response, params);
          break;
        case "/build-with-zip":
          handleBuildWithZip(request, response, params);
          break;
        case "/check-status":
          handleCheckStatus(request, response, params);
          break;
      }
      responseError(response, 404, "404 Not found.");
    } catch (error) {
      responseError(response, 500, "Server internal error.");
      console.error(error);
    }
  });
  console.timeLog("listening port at: " + PORT, true);
  server.listen(PORT);
}

console.timeLog = (msg: string) => console.log("[" + new Date().toLocaleString() + "] " + msg);

fs.ensureDirSync(TEMP_DIR);
if (EMPTY_TEMP_DIR_BEFORE_BUILD) {
  fs.emptyDirSync(TEMP_DIR);
}
startServer();
import * as http from "http";
import * as url from "url";
import * as fs from "fs-extra";

import { PORT, TEMP_DIR } from "./config";
import handleBuildWithGithubRepo from "./pages/build-with-github-repo";
import handleBuildWithZip from "./pages/build-with-zip";

export const CONTENT_TYPE_JSON = {"Content-Type": "application/json"};
export function responseError(response: http.ServerResponse, code: number, msg: string) {
  response.writeHead(code, CONTENT_TYPE_JSON);
  response.end(JSON.stringify({
    status: "error",
    msg: msg
  }));
}

function startServer() {
  let server = http.createServer((request, response) => {
    try {
      let requestUrl = url.parse(request.url);
      let params = new url.URLSearchParams(requestUrl.query);
  
      console.log("pathname= " + requestUrl.pathname);
      console.log("params= " + params);
      switch (requestUrl.pathname) {
        case "/build-with-github-repo":
          handleBuildWithGithubRepo(request, response, params);
          break;
        case "/build-with-zip":
          handleBuildWithZip(request, response, params);
          break;
      }
      responseError(response, 404, "404 Not found.");
    } catch (error) {
      responseError(response, 500, "Server internal error.");
      console.error(error);
    }
  });
  console.log("[" + new Date().toISOString() + "] listening port at: " + PORT);
  server.listen(PORT);
}

fs.ensureDirSync(TEMP_DIR);
fs.emptyDirSync(TEMP_DIR);
startServer();
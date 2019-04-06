import * as fs from "fs-extra";

import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { JobPool } from "../builder";
import { OUTPUT_DIR, CHECK_JOBPOOL_RESULTS_ONLY } from "../config";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  let jobId = params.get("jobId");
  if (!JobPool.has(jobId) && !CHECK_JOBPOOL_RESULTS_ONLY && !fs.existsSync(OUTPUT_DIR + "/" + jobId + ".zip")) {
    console.log("Response end with 404: job not exist");
    response.writeHead(404);
    response.end("Job not exist.");
    return;
  }
  let status = JobPool.has(jobId) ? JobPool.get(jobId).status : "done";
  if (status != "done") {
    console.log("Response end with 404 job is not ready yet");
    response.writeHead(404);
    response.end("Job not ready yet.");
    return;
  } else {
    let zipPath = OUTPUT_DIR + "/" + jobId + ".zip";
    var stat = fs.statSync(zipPath);
    console.log("Response end with 200 (build result will be sent)");
    response.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": stat.size
    });
    fs.createReadStream(zipPath).pipe(response, { end: true });
  }
}
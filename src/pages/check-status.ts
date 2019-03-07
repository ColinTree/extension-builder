import * as fs from "fs-extra";
import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { responseSuccess, responseError } from "../index";
import { JobPool } from "../builder";
import { OUTPUT_DIR, CHECK_JOBPOOL_RESULTS_ONLY } from "../config";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  let jobId = params.get("jobId");
  if (!JobPool.has(jobId) && !CHECK_JOBPOOL_RESULTS_ONLY && !fs.existsSync(OUTPUT_DIR + "/" + jobId + ".zip")) {
    responseError(response, 404, "Specified job does not exist.");
    return;
  }
  let ret: { [key: string]: string | number | boolean } = {};
  if (JobPool.has(jobId)) {
    let job = JobPool.get(jobId);
    ret.status = job.status;
    for (let key in job.extraInfo) {
      ret[key] = job.extraInfo[key];
    }
  } else {
    ret.status = "done";
  }
  responseSuccess(response, ret);
}
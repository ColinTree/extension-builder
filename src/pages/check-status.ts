import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { responseSuccess, responseError } from "../index";
import { JobPool, JobStatus } from "../builder";
import * as fs from "fs-extra";
import { OUTPUT_DIR } from "../config";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  let jobId = params.get("jobId");
  if (!JobPool.has(jobId) && !fs.existsSync(OUTPUT_DIR + "/" + jobId + ".zip")) {
    responseError(response, 404, "Specified job does not exist in job pool.");
    return;
  }
  let ret: { [key: string]: string | number } = {};
  if (JobPool.has(jobId)) {
    let job = JobPool.get(jobId);
    ret.status = job.status;
    for (let key in job.extraInfo) {
      ret[key] = job.extraInfo[key];
    }
  } else {
    ret.status = JobStatus.done;
  }
  responseSuccess(response, ret);
}
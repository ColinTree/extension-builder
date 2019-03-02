import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { responseSuccess, responseError } from "../index";
import { JobPool } from "../builder";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  let jobId = params.get("jobId");
  if (!JobPool.has(jobId)) {
    // TODO: try harder to find this job in "build-result"?
    responseError(response, 404, "Specified job does not exist in job pool.");
    return;
  }
  responseSuccess(response, { status: JobPool.get(jobId).status });
}
import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { responseError } from "../index";
import { ENABLE_REPO_WHITELIST } from "../config";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  if (ENABLE_REPO_WHITELIST) {
    responseError(response, 403, "Currently in white list mode, build with zip is disabled");
    return;
  } else {
    responseError(response, 501, "build with zip is not implemented yet.");
    return;
  }
}
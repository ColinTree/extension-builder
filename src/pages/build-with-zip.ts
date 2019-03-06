import * as AdmZip from "adm-zip";
import * as formidable from "formidable"

import { IncomingMessage, ServerResponse } from "http";
import { URLSearchParams } from "url";

import { responseError, responseSuccess } from "../index";
import { ENABLE_REPO_WHITELIST, TEMP_DIR } from "../config";
import { Job, pushBuildQueue } from "../builder";

export default (request: IncomingMessage, response: ServerResponse, params: URLSearchParams) => {
  if (ENABLE_REPO_WHITELIST) {
    responseError(response, 403, "Currently in white list mode, build with zip is disabled");

  } else {
    let job = new Job();
    job.attachInfo("buildType", "source-upload");

    let type = request.headers["content-type"] || "";
    if (!type.includes("multipart/form-data")) {
      console.log("Request content type: " + type);
      responseError(response, 400, "Please use multipart/form-data format");
      return;
    }

    let jobDir = TEMP_DIR + "/" + job.id + "/";
    let form = new formidable.IncomingForm();
    form.uploadDir = jobDir;
    form.keepExtensions = true;
    form.on("file", (name, file) => {
      if (name != "source") {
        return;
      }
      let zip = new AdmZip(file.path);
      zip.extractAllTo(jobDir + "/src/");
      pushBuildQueue(job);
      responseSuccess(response, {
        msg: "Job added.",
        jobId: job.id
      });
    });
    form.on("error", err => {
      responseError(response, 500, err);
    })
    form.parse(request);
    return;
  }
}
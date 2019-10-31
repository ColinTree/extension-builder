import { Dictionary } from 'express-serve-static-core';
import * as fs from 'fs-extra';
import { Context } from 'koa';
import { CHECK_JOBPOOL_RESULTS_ONLY, OUTPUT_DIR } from '../configs';
import JobPool from '../JobPool.class';

export default (ctx: Context) => {
  const jobId = ctx.query.jobId as string;
  if (!JobPool.has(jobId) && !CHECK_JOBPOOL_RESULTS_ONLY && !fs.existsSync(`${OUTPUT_DIR}/${jobId}.zip`)) {
    ctx.throw(404, 'Specified job does not exist.');
  }
  const ret: Dictionary<string | number | boolean> = {};
  if (JobPool.has(jobId)) {
    const job = JobPool.get(jobId);
    ret.status = job.status;
    Object.keys(job.extraInfo).forEach(key => {
      ret[key] = job.extraInfo[key];
    });
  } else {
    ret.status = 'done';
  }
  ctx.body = ret;
};

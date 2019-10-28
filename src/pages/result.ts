import * as fs from 'fs-extra';
import { Context } from 'koa';
import { CHECK_JOBPOOL_RESULTS_ONLY, OUTPUT_DIR } from '../configs';
import JobPool from '../JobPool.class';

export default (ctx: Context) => {
  const jobId = ctx.query.jobId as string;
  if (!JobPool.has(jobId) && !CHECK_JOBPOOL_RESULTS_ONLY && !fs.existsSync(`${OUTPUT_DIR}/${jobId}.zip`)) {
    ctx.throw(404, 'Job not exist.');
  }
  const status = JobPool.has(jobId) ? JobPool.get(jobId).status : 'done';
  if (status !== 'done') {
    ctx.throw(404, 'Job not ready yet.');
  } else {
    const zipPath = `${OUTPUT_DIR}/${jobId}.zip`;
    const contentLength = fs.statSync(zipPath).size;
    ctx.status = 200;
    ctx.type = 'application/zip';
    ctx.set('Content-Length', String(contentLength));
    ctx.body = fs.createReadStream(zipPath);
  }
};

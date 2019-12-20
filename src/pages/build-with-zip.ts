import * as AdmZip from 'adm-zip';
import { Context } from 'koa';
import { join } from 'path';
import BuildQueue from '../BuildQueue.class';
import { BUILD_WITH_ZIP_ENABLED, REPO_WHITELIST_ENABLED, TEMP_DIR } from '../configs';
import Job from '../Job.class';

export default (ctx: Context) => {
  if (!BUILD_WITH_ZIP_ENABLED) {
    ctx.throw(403, 'Build with zip not enabled');
  }
  if (REPO_WHITELIST_ENABLED) {
    ctx.throw(403, 'Currently in white list mode, build with zip is disabled');
  }
  const job = new Job('source-upload');

  if (!('source' in ctx.request.files)) {
    ctx.throw(400, 'No file uploaded');
  }
  const jobDir = join(TEMP_DIR, job.id);
  const zip = new AdmZip(ctx.request.files.source.path);
  zip.extractAllTo(join(jobDir, 'src'));
  BuildQueue.enqueue(job);
  ctx.body = {
    msg: 'Job added.',
    jobId: job.id,
  };
};

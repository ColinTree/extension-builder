import { copyFileSync, ensureDirSync } from 'fs-extra';
import { Context } from 'koa';
import { join } from 'path';
import BuildQueue from '../BuildQueue.class';
import { BUILD_WITH_PLAIN_SOURCE_ENABLED, REPO_WHITELIST_ENABLED, TEMP_DIR } from '../configs';
import Job from '../Job.class';

export default (ctx: Context) => {
  if (!BUILD_WITH_PLAIN_SOURCE_ENABLED) {
    ctx.throw(403, 'Build with plain source not enabled');
  }
  if (REPO_WHITELIST_ENABLED) {
    ctx.throw(403, 'Currently in white list mode, build with zip is disabled');
  }

  if (!('source' in ctx.request.files)) {
    ctx.throw(400, 'No file uploaded');
  }

  const job = new Job('plain-source-upload');

  const jobDir = join(TEMP_DIR, job.id, 'src');
  ensureDirSync(jobDir);
  copyFileSync(ctx.request.files.source.path, join(jobDir, ctx.request.files.source.name));

  BuildQueue.enqueue(job);
  ctx.body = {
    msg: 'Job added.',
    jobId: job.id,
  };
};

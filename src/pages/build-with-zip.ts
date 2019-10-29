import * as AdmZip from 'adm-zip';
import * as formidable from 'formidable';
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
  const job = new Job();
  job.attachInfo('buildType', 'source-upload');

  const type = ctx.headers['content-type'] || '';
  if (!type.includes('multipart/form-data')) {
    console.log('Request content type: ' + type);
    ctx.throw(400, 'Please use multipart/form-data format');
  }

  const jobDir = join(TEMP_DIR, job.id);
  const form = new formidable.IncomingForm();
  form.uploadDir = jobDir;
  form.keepExtensions = true;
  form.on('file', (name, file) => {
    if (name !== 'source') {
      return;
    }
    const zip = new AdmZip(file.path);
    zip.extractAllTo(join(jobDir, 'src'));
    BuildQueue.enqueue(job);
    ctx.body = {
      msg: 'Job added.',
      jobId: job.id,
    };
  });
  form.on('error', err => {
    ctx.throw(500, err);
  });
  form.parse(ctx.req);
};

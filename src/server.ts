import * as fs from 'fs-extra';
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as serve from 'koa-static';
import { KEEP_LEGACY_RESULTS, PORT, TEMP_DIR } from './configs';
import buildWithGithubRepo from './pages/build-with-github-repo';
import buildWithZip from './pages/build-with-zip';
import checkStatus from './pages/check-status';
import result from './pages/result';

const app = new Koa();
const router = new Router();

router.get('/build-with-github-repo', buildWithGithubRepo.get);
router.post('/build-with-github-repo', buildWithGithubRepo.post); // webhook
router.get('/build-with-zip', buildWithZip);
router.get('/check-status', checkStatus);
router.get('/result', result);

app.use(serve('static'));
app.use(async (ctx, next) => {
  try {
    await next();
    ctx.status = 200;
    if (ctx.body instanceof fs.ReadStream) {
      console.log('Response end with 200: { A file is returned }');
    } else {
      if (typeof ctx.body !== 'object') {
        ctx.body = { msg: ctx.body };
      }
      ctx.type = 'json';
      ctx.body = JSON.stringify(ctx.body);
      console.log(`Response end with 200: ${ctx.body}`);
    }
  } catch (e) {
    ctx.status = e.status;
    ctx.type = 'json';
    ctx.body = JSON.stringify({ msg: (e as Error).message });
    console.log(`Response end with ${ctx.status}: ${(e as Error).message}`);
  }
});
app.use(router.routes());

console.timeLog = (msg: string) => console.log('[' + new Date().toLocaleString() + '] ' + msg);

fs.ensureDirSync(TEMP_DIR);
if (!KEEP_LEGACY_RESULTS) {
  fs.emptyDirSync(TEMP_DIR);
}

console.timeLog(`Listening port at: ${PORT}`, true);
app.listen(PORT);

import * as fs from 'fs-extra';
import * as Koa from 'koa';
import * as koaBody from 'koa-body';
import * as Router from 'koa-router';
import * as serve from 'koa-static';
import { KEEP_LEGACY_RESULTS, PORT, SERVER_STATUS_API_ENABLED, SERVER_STATUS_PAGE_ENABLED, TEMP_DIR } from './configs';
import buildWithGithubRepo from './pages/build-with-github-repo';
import buildWithPlainSource from './pages/build-with-plain-source';
import buildWithZip from './pages/build-with-zip';
import checkServerStatus from './pages/check-server-status';
import checkStatus from './pages/check-status';
import result from './pages/result';

const app = new Koa();
const router = new Router();

router.get('/build-with-github-repo', buildWithGithubRepo.get);
router.post('/build-with-github-repo', buildWithGithubRepo.post); // webhook
router.post('/build-with-plain-source', koaBody({ multipart: true }), buildWithPlainSource);
router.post('/build-with-zip', koaBody({ multipart: true }), buildWithZip);
router.get('/check-server-status', checkServerStatus);
router.get('/check-status', checkStatus);
router.get('/result', result);

app.use(async (ctx, next) => {
  console.timeLog(`${ctx.method} ${ctx.url}`);
  await next();
});
app.use(async (ctx, next) => {
  if (ctx.url === '/server-status.html' &&
      (SERVER_STATUS_API_ENABLED === false || SERVER_STATUS_PAGE_ENABLED === false)) {
    ctx.status = 403;
    ctx.body = 'This page is disabled by config';
    console.timeLog(`server-status requests are forbidden by config`);
  } else {
    await next();
  }
});
app.use(serve('../static'));
app.use(async (ctx, next) => { // api handler
  try {
    await next();
    ctx.status = 200;
    if (ctx.body instanceof fs.ReadStream) {
      console.timeLog(`[${ctx.url}] Response end with 200: { A file will be sent }`);
    } else {
      if (typeof ctx.body !== 'object') {
        ctx.body = { msg: ctx.body };
      }
      ctx.type = 'json';
      ctx.body = JSON.stringify(ctx.body);
      console.timeLog(`[${ctx.url}] Response end with 200: ${ctx.body}`);
    }
  } catch (e) {
    ctx.status = isFinite(e.status) ? e.status : 500;
    ctx.type = 'json';
    ctx.body = JSON.stringify({ msg: (e as Error).message });
    console.timeLog(`[${ctx.url}] Response end with ${ctx.status}: ${(e as Error).message}`);
  }
});
app.use(router.routes());
app.use(ctx => {
  ctx.throw(404);
});

console.timeLog = (msg: string) => console.log(`[${new Date().toLocaleString()}] ${msg}`);

fs.ensureDirSync(TEMP_DIR);
if (!KEEP_LEGACY_RESULTS) {
  fs.emptyDirSync(TEMP_DIR);
}

console.timeLog(`Listening port at: ${PORT}`, true);
app.listen(PORT);

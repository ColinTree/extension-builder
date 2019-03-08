import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs-extra';
import * as mimeTypes from 'mime-types'

import { PORT, TEMP_DIR, KEEP_LEGACY_RESULTS, STATIC_DIR } from './config';
import handleBuildWithGithubRepo from './pages/build-with-github-repo';
import handleBuildWithZip from './pages/build-with-zip';
import handleCheckStatus from './pages/check-status';
import handleResult from './pages/result';

export const CONTENT_TYPE_JSON = {'Content-Type': 'application/json'};
export function responseSuccess(response: http.ServerResponse, info: object | string) {
  if (typeof(info) == 'string') {
    info = { msg: info };
  }
  info = JSON.stringify(info);
  console.log('Response end with 200: ' + info);
  response.writeHead(200, CONTENT_TYPE_JSON);
  response.end(info);
}
export function responseError(response: http.ServerResponse, code: number, msg: string) {
  console.log('Response end with ' + code + ': ' + msg);
  response.writeHead(code, CONTENT_TYPE_JSON);
  response.end(JSON.stringify({ msg }));
}

const STATIC_FILE_MAP: { [key: string]: string; } = {
  '':  'index.html',
  '/': 'index.html'
}
function handleStaticFile(response: http.ServerResponse, pathname: string): boolean {
  console.log('Checking static file raw pathname="' + pathname + '"');
  if (pathname.split('/../').length > 1) {
    console.log('This url seems like a crack, does not consider it is a static file.');
    return false;
  }
  let staticDir = __dirname + '/../' + STATIC_DIR + '/';
  if (!fs.existsSync(staticDir + pathname) || fs.statSync(staticDir + pathname).isDirectory()) {
    pathname = STATIC_FILE_MAP[pathname];
    if (!fs.existsSync(staticDir + pathname) || fs.statSync(staticDir + pathname).isDirectory()) {
      console.log('Neither original pathname nor mapped pathname is exist (or is a dir), not returning static file');
      return false;
    }
  }
  pathname = staticDir + pathname;
  let mime = mimeTypes.lookup(pathname);
  console.log('Response end with 200: static file(' + pathname + ') mime(' + mime + ')');
  response.writeHead(200, { 'Content-Type': mime!==false ? mime : 'application/octet-stream' });
  fs.createReadStream(pathname).pipe(response, { end: true });
  return true;
}

function startServer() {
  let server = http.createServer((request, response) => {
    try {
      let requestUrl = url.parse(request.url);
      let params = new url.URLSearchParams(requestUrl.query);
      console.timeLog('Processing request: ' + request.url);
      switch (requestUrl.pathname) {
        case '/build-with-github-repo': {
          handleBuildWithGithubRepo(request, response, params);
          return;
        }
        case '/build-with-zip': {
          handleBuildWithZip(request, response, params);
          return;
        }
        case '/check-status': {
          handleCheckStatus(request, response, params);
          return;
        }
        case '/result': {
          handleResult(request, response, params);
          return;
        }
        default: {
          if (handleStaticFile(response, requestUrl.pathname)) {
            return;
          }
        }
      }
      responseError(response, 404, '404 Not found.');
    } catch (error) {
      responseError(response, 500, 'Server internal error.');
      console.error(error);
    }
  });
  console.timeLog('Listening port at: ' + PORT, true);
  server.listen(PORT);
}

console.timeLog = (msg: string) => console.log('[' + new Date().toLocaleString() + '] ' + msg);

fs.ensureDirSync(TEMP_DIR);
if (!KEEP_LEGACY_RESULTS) {
  fs.emptyDirSync(TEMP_DIR);
}
startServer();
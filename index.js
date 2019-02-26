let http = require("http");
let exec = require("./exec");

const PORT = 8048;
const AI_WORKSPACE = "/var/extension-builder/workspace/appinventor-sources";
const AI_GITHUB_URL = "https://github.com/mit-cml/appinventor-sources.git";
const GIT_FOLDER_NAME = ".git";

ensureAiSourceExist();

function ensureAiSourceExist() {
  exec("cd " + AI_WORKSPACE + "/" + GIT_FOLDER_NAME)
  .then(() => {
    console.log("ai repo exists in " + AI_WORKSPACE);
    exec("cd " + AI_WORKSPACE + " && " + "git pull")
    .then(() => startServer());
  })
  .catch(() => {
    exec("cd " + AI_WORKSPACE + " && git clone " + AI_GITHUB_URL)
    .then(() => {
      ensureAiSourceExist();
    });
  });
}

function startServer() {
  let deployServer = http.createServer((request, response) => {
    response.writeHead(200);
    response.end("Not available for use yet.");

    //exec("git reset --hard HEAD && git clean -f")
    //.then(stdout => {});
  });
  console.log("listening port at: " + PORT);
  deployServer.listen(PORT);
}
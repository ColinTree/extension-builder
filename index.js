let http = require("http");
let exec = require("./exec");

const PORT = 8048;
const AI_WORKSPACE = "/usr/workspace";

startServer();

function startServer() {
  let deployServer = http.createServer((request, response) => {
    let content = "";
  
    request.on('data', chunk => {
      content += chunk;
    });
  
    request.on('end', () => {
      exec("cd " + AI_WORKSPACE + " && git status && git reset --hard HEAD && git clean -f && git status")
      .then(stdout => {
        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write(stdout);
        response.end();
      });
    });
  });
  console.log("listening port at: " + PORT);
  deployServer.listen(PORT);
}
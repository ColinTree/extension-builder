import * as os from "os";

export const WORKSPACE = "/usr/workspace/";
export const ENABLE_REPO_WHITELIST = true;
export const PORT = 8048;
export const TEMP_DIR = os.tmpdir() + "/extension-builder/";
export const BUILDER_CONFIG_NAME = "builder-config.json";
export const OUTPUT_DIR = "/usr/build-result/";
export const STATIC_DIR = "./static/";

export const EMPTY_TEMP_DIR_BEFORE_BUILD = false;

interface WhiteList {
  owner: string;
  repoName: string;
  nodes: string | string[]; // Nodes includes branchs, commits and tags. Can be "*" for any
}
const REPO_WHITELIST: WhiteList[] = [
  { owner: "OpenSourceAIX", repoName: "ColinTreeListView", nodes: "extension-builder-test" }
];
export function inWhitelist(owner: string, repoName: string, codeNode = "") {
  for (let i in REPO_WHITELIST) {
    if (REPO_WHITELIST.hasOwnProperty(i)) {
      let item = REPO_WHITELIST[i];
      if (owner == item.owner && repoName == item.repoName) {
        let acceptNodes = item.nodes;
        if (acceptNodes == "*") {
          return true;
        } else {
          acceptNodes = typeof(acceptNodes)=="string" ? [ acceptNodes ] : acceptNodes;
          return acceptNodes.includes(codeNode);
        }
      }
    }
  }
  return false;
}
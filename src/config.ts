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
  branch: string | string[];
}
const REPO_WHITELIST: WhiteList[] = [
  { owner: "OpenSourceAIX", repoName: "ColinTreeListView", branch: "extension-builder-test" }
];
export function inWhitelist(owner: string, repoName: string, branch = "master") {
  for (let i in REPO_WHITELIST) {
    if (REPO_WHITELIST.hasOwnProperty(i)) {
      let item = REPO_WHITELIST[i];
      if (owner == item.owner && repoName == item.repoName) {
        let acceptBranchs = item.branch;
        if (acceptBranchs == "*") {
          return true;
        } else {
          acceptBranchs = typeof(acceptBranchs)=="string" ? [ acceptBranchs ] : acceptBranchs;
          return acceptBranchs.includes(branch);
        }
      }
    }
  }
  return false;
}
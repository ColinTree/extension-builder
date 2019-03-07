import * as os from "os";
import * as fs from "fs-extra";

// load default config & custom config
let DEF_CONF = require("../eb-config.default.json");
let CUST_CONF = fs.existsSync("../eb-config.json") ? require("../eb-config.json") : {};

export const PORT =
    CUST_CONF["port"] ? CUST_CONF["port"] : DEF_CONF["port"];

export const BUILDER_CONFIG_NAME =
    CUST_CONF["builder-config-name"] ? CUST_CONF["builder-config-name"] : DEF_CONF["builder-config-name"];
export const EMPTY_TEMP_DIR_BEFORE_BUILD =
    CUST_CONF["empty-temp-dir-before-build"] ? CUST_CONF["empty-temp-dir-before-build"] : DEF_CONF["empty-temp-dir-before-build"];
export const OUTPUT_DIR =
    CUST_CONF["output-dir"] ? CUST_CONF["output-dir"] : DEF_CONF["output-dir"];
export const STATIC_DIR =
    CUST_CONF["static-dir"] ? CUST_CONF["static-dir"] : DEF_CONF["static-dir"];
export const TEMP_DIR =
    (<string> CUST_CONF["temp-dir"] ? CUST_CONF["temp-dir"] : DEF_CONF["temp-dir"])
    .replace("%SYSTEM_TEMP%", os.tmpdir());
export const WORKSPACE =
    CUST_CONF["workspace"] ? CUST_CONF["workspace"] : DEF_CONF["workspace"];

export const ENABLE_REPO_WHITELIST =
    CUST_CONF["whitelist-enabled"] ? CUST_CONF["whitelist-enabled"] : DEF_CONF["whitelist-enabled"];

interface WhiteList {
  owner: string;
  repoName: string;
  refs: string | string[]; // refs includes branchs, commits and tags. Can be "*" for any
}
const REPO_WHITELIST: WhiteList[] =
    CUST_CONF["whitelist"] ? CUST_CONF["whitelist"] : DEF_CONF["whitelist"];
export function inWhitelist(owner: string, repoName: string, coderef = "") {
  for (let i in REPO_WHITELIST) {
    if (REPO_WHITELIST.hasOwnProperty(i)) {
      let item = REPO_WHITELIST[i];
      if (owner == item.owner && repoName == item.repoName) {
        let acceptRefs = item.refs;
        if (acceptRefs == "*") {
          return true;
        } else {
          acceptRefs = typeof(acceptRefs)=="string" ? [ acceptRefs ] : acceptRefs;
          return acceptRefs.includes(coderef);
        }
      }
    }
  }
  return false;
}
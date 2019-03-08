import * as os from 'os';
import * as fs from 'fs-extra';
import * as Github from '@octokit/rest';

// load default config & custom config
const DEF_CONF = require('../eb-config.default.json');
const CUST_CONF = fs.existsSync('../eb-config.json') ? require('../eb-config.json') : {};

export const PORT =
    CUST_CONF['port'] ? CUST_CONF['port'] : DEF_CONF['port'];

export const BUILDER_CONFIG_NAME =
    CUST_CONF['builder-config-name'] ? CUST_CONF['builder-config-name'] : DEF_CONF['builder-config-name'];
export const CHECK_JOBPOOL_RESULTS_ONLY =
    CUST_CONF['check-jobpool-results-only'] ? CUST_CONF['check-jobpool-results-only'] : DEF_CONF['check-jobpool-results-only'];
export const KEEP_LEGACY_RESULTS =
    CUST_CONF['keep-legacy-results'] ? CUST_CONF['keep-legacy-results'] : DEF_CONF['keep-legacy-results'];
export const OUTPUT_DIR =
    CUST_CONF['output-dir'] ? CUST_CONF['output-dir'] : DEF_CONF['output-dir'];
export const STATIC_DIR =
    CUST_CONF['static-dir'] ? CUST_CONF['static-dir'] : DEF_CONF['static-dir'];
export const TEMP_DIR =
    (<string> CUST_CONF['temp-dir'] ? CUST_CONF['temp-dir'] : DEF_CONF['temp-dir'])
    .replace('%SYSTEM_TEMP%', os.tmpdir());
export const WORKSPACE =
    CUST_CONF['workspace'] ? CUST_CONF['workspace'] : DEF_CONF['workspace'];

export const ENABLE_REPO_WHITELIST =
    CUST_CONF['whitelist-enabled'] ? CUST_CONF['whitelist-enabled'] : DEF_CONF['whitelist-enabled'];

interface WhiteList {
  owner: string;
  repo: string;
  refs: string | string[]; // refs includes branchs, commits and tags. Can be '*' for any
}
const REPO_WHITELIST: WhiteList[] =
    CUST_CONF['whitelist'] ? CUST_CONF['whitelist'] : DEF_CONF['whitelist'];
export function inWhitelist(owner: string, repo: string, coderef = '') {
  for (let i in REPO_WHITELIST) {
    if (REPO_WHITELIST.hasOwnProperty(i)) {
      let item = REPO_WHITELIST[i];
      if (owner == item.owner && repo == item.repo) {
        let acceptRefs = item.refs;
        if (acceptRefs == '*') {
          return true;
        } else {
          acceptRefs = typeof(acceptRefs)=='string' ? [ acceptRefs ] : acceptRefs;
          return acceptRefs.includes(coderef);
        }
      }
    }
  }
  return false;
}

export const GITHUB_AUTH_TYPE: 'none' | 'basic' | 'token' =
    CUST_CONF['github-auth-type'] ? CUST_CONF['github-auth-type'] : 'none';
const GITHUB_LOGGER = {
  debug: (message: string, info?: object) => {
    console.log('[github.debug] ' + message);
  },
  info: (message: string, info?: object) => {
    console.log('[github.info] ' + message);
  },
  warn: (message: string, info?: object) => {
    console.log('[github.warn] ' + message);
  },
  error: (message: string, info?: object) => {
    console.log('[github.error] ' + message);
  }
};
export function AuthGithub() {
  let auth;
  switch (GITHUB_AUTH_TYPE) {
    case 'basic': {
      console.log('Login github with username & password');
      auth = {
        username: CUST_CONF['github-auth-username'],
        password: CUST_CONF['github-auth-password'],
        on2fa: async () => { throw '2FA required, extension-builder dont support this yet.' }
      }
      break;
    }
    case 'token': {
      console.log('Login github with token');
      auth = 'token ' + CUST_CONF['github-auth-token'];
      break;
    }
    default: {
      console.log('Didn\'t find a method login onto github');
    }
  }
  return new Github({
    auth,
    log: GITHUB_LOGGER
  });
}
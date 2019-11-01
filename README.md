# extension-builder

![GitHub package.json version](https://img.shields.io/github/package-json/v/ColinTree/extension-builder)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/ColinTree/extension-builder)

This is a cloud build system of app inventor extensions

* [Formal server](http://bot.colintree.cn:8048)
* [Dev server](http://bot.colintree.cn:8049)

[Github source](https://github.com/ColinTree/extension-builder)

**Table of Content**

- [extension-builder](#extension-builder)
  - [Upgrade from 1.x](#upgrade-from-1x)
  - [How to deploy](#how-to-deploy)
    - [Additional Config before build & deploy](#additional-config-before-build--deploy)
    - [View server log](#view-server-log)
  - [How to use [optional builder config in extension source]](#how-to-use-optional-builder-config-in-extension-source)

## Upgrade from 1.x

The major different between 1.x and 2.2+ is the location of config files.
So the most important upgrade is to rename your `eb-config.json` with `local.json`.

## How to deploy

In your server, run:

```shell
cd /path/to/extension-builder/
git pull

docker stop extension-builder || true
docker rm extension-builder || true
docker build . -t extension-builder
docker run -d -p 8048:8048 --restart unless-stopped --name="extension-builder" extension-builder
```

### Additional Config before build & deploy

for `local.json`, we accept the following configs:

* port
  * number
  * default to `8048`
  * The port number of the service.
  * *Note*: this is not necessary to change for a docker deploy, you can do that by changing docker port expose (using `-p xxxx:8048`)

* builder-config-name
  * string
  * default to `"builder-config.json"`
  * The config file name to read from build jobs

* check-jobpool-results-only
  * boolean
  * default to `false`
  * To control whether job result would be return when result achieve is found but the job is not in the job pool

* keep-legacy-results
  * boolean
  * default to `true`
  * To control whether temp dir will be cleaned every time server started

* output-dir
  * string
  * default to `"/usr/build-result/"`

* temp-dir
  * string
  * default to `"%SYSTEM_TEMP%/extension-builder/"`
  * *Note*: `"%SYSTEM_TEMP%"` can be used to denote system temp dir

* workspace
  * string
  * default to `"/usr/workspace/"`
  * The workspace to build extension

* build-with-github-repo-enabled
  * boolean
  * default to `true`

* build-with-zip-enabled
  * boolean
  * default to `true`

* build-with-plain-source-enabled
  * boolean
  * default to `false`

* whitelist-enabled
  * boolean
  * default to `false`
  * *Note*: Enabling whitelist will disable build-with-zip and build-with-plain-source automatically

* whitelist
  * array of { "owner": "...", "repo": "...", "refs": "..." }
  * default to master branch of OpenSourceAIX/ColinTreeListView
  * For refs, `*` can be used to denote any branch/tag/commit

* github-auth-type
  * 'none' | 'basic' | 'token'
  * default to 'none'
  * Used when a push to release is required, and deciding the type of github auth
  * See https://octokit.github.io/rest.js/#authentication for more

* github-auth-username
  * string
  * no default value
  * Used when github-auth-type is basic

* github-auth-password
  * string
  * no default value
  * Used when github-auth-type is basic

* github-auth-token
  * string
  * no default value
  * Used when github-auth-type is token

### View server log

```sh
docker exec -it extension-builder pm2 logs
```

sometimes you would need to exec:

```sh
docker exec -it extension-builder /bin/sh
pm2 logs
```

## How to use [optional builder config in extension source]

Extension-builder accepts zero-configured extension sources, while `builder-config.json` can also be put in the same directory of your extension java file when it's necessary.

`builder-config.json` Accepts:

```json5
{
  // [Optional] Same package name with your extension(s)
  //            If this is left blank, builder will try to detect from your java files
  "package": @string,
  // [Optional] This will be affective only if the build is called by webhook
  "pushToRelease": @boolean
}
```

Sample config: https://github.com/OpenSourceAIX/ColinTreeListView/blob/master/builder-config.json
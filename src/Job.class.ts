import { Dictionary } from 'express-serve-static-core';
import { ensureDirSync, mkdtempSync } from 'fs-extra';
import { TEMP_DIR } from './configs';
import JobPool from './JobPool.class';

// tslint:disable-next-line no-var-requires
const pkg = require('../package.json');

export type JobStatus = 'preparing' | 'waiting' | 'building' | 'done' | 'failed';
export interface JobConfig {
  package?: string;
  pushToRelease?: boolean;
}
export type JobBuildType = 'github-repo' | 'plain-source-upload' | 'source-upload';

export default class Job {

  public readonly id: string;
  public readonly builderVersion: string;
  public readonly startTimestamp: number;
  public readonly buildType: JobBuildType;
  public readonly extraInfo: Dictionary<string | number | boolean> = {};

  public status: JobStatus;

  public constructor (buildType: JobBuildType) {
    ensureDirSync(TEMP_DIR);
    const jobDir = mkdtempSync(TEMP_DIR + '/');
    this.id = jobDir.substring(jobDir.lastIndexOf('/') + 1);
    this.builderVersion = pkg.version;
    this.startTimestamp = Date.now();
    this.buildType = buildType;
    this.status = 'preparing';
    JobPool.add(this);
  }

  public attachInfo (key: string, value: string | number | boolean) {
    this.extraInfo[key] = value;
  }

}

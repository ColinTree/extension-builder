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

export default class Job {

  public readonly id: string;
  public readonly extraInfo: Dictionary<string | number | boolean> = {};

  public status: JobStatus;

  public constructor () {
    ensureDirSync(TEMP_DIR);
    const jobDir = mkdtempSync(TEMP_DIR + '/');
    this.id = jobDir.substring(jobDir.lastIndexOf('/') + 1);
    this.status = 'preparing';
    this.attachInfo('builderVersion', pkg.version);
    this.attachInfo('startTimestamp', Date.now());
    JobPool.add(this);
  }

  public attachInfo (key: string, value: string | number | boolean) {
    this.extraInfo[key] = value;
  }

}

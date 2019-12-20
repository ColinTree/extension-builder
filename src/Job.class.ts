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
  public readonly submitTimestamp: number;
  public readonly buildType: JobBuildType;
  public readonly extraInfo: Dictionary<string | number | boolean> = {};

  // tslint:disable-next-line variable-name
  private _status: JobStatus;
  // tslint:disable-next-line variable-name
  private _startTimestamp: number;
  // tslint:disable-next-line variable-name
  private _endTimestamp: number;

  public set status (val: JobStatus) {
    this._status = val;
    if (val === 'building') {
      this._startTimestamp = Date.now();
    }
    if (val === 'done' || val === 'failed') {
      this._endTimestamp = Date.now();
    }
  }
  public get status () {
    return this._status;
  }
  public get startTimestamp () {
    return this._startTimestamp;
  }
  public get endTimestamp () {
    return this._endTimestamp;
  }

  public constructor (buildType: JobBuildType) {
    ensureDirSync(TEMP_DIR);
    const jobDir = mkdtempSync(TEMP_DIR + '/');
    this.id = jobDir.substring(jobDir.lastIndexOf('/') + 1);
    this.builderVersion = pkg.version;
    this.submitTimestamp = Date.now();
    this.buildType = buildType;
    this._status = 'preparing';
    this._startTimestamp = -1;
    this._endTimestamp = -1;
    JobPool.add(this);
  }

  public attachInfo (key: string, value: string | number | boolean) {
    this.extraInfo[key] = value;
  }

}

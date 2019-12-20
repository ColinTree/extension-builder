import { Dictionary } from 'express-serve-static-core';
import { Context } from 'koa';
import * as moment from 'moment';
import Builder from '../Builder.class';
import { SERVER_STATUS_API_ENABLED } from '../configs';
import { JobBuildType, JobStatus } from '../Job.class';
import JobPool from '../JobPool.class';

export interface SimpleJobDescriptor {
  timeSubmit: number;
  timeStart: number;
  timeEnd: number;
  type: JobBuildType;
  status: JobStatus;
}

type Counter = Dictionary<SimpleJobDescriptor[]>;

interface Cache {
  counter: Counter;
  stable: boolean;
  time: moment.Moment;
  lastJobId: string;
}
let cache = null as Cache;

const DAY_SUBSTRACT = 30;
const DATE_FORMAT = 'Y-MM-DD';

function ensureCounterFashion (source: Counter) {
  const counter = {} as Counter;
  const now = moment();
  for (let i = 0; i < DAY_SUBSTRACT; i++) {
    const dateString = now.format(DATE_FORMAT);
    counter[dateString] = source[dateString] || [];
    now.subtract(1, 'day');
  }
  return counter;
}

function generateCounter () {
  const rawCounter = {} as Counter;
  // get 0:00 of start date
  const MOMENT_START = moment(moment().subtract(DAY_SUBSTRACT, 'days').format(DATE_FORMAT), DATE_FORMAT);

  // stable represents whether all jobs had been done/failed
  let stable = true;

  const idsInPool = JobPool.getJobIds();
  let jobIdIter: IteratorResult<string, any>;
  while (!(jobIdIter = idsInPool.next()).done) {
    const job = JobPool.get(jobIdIter.value);
    const jobTime = moment(job.submitTimestamp, 'x');
    if (jobTime.isBefore(MOMENT_START)) {
      continue;
    }
    const jobDate = jobTime.format(DATE_FORMAT);
    (rawCounter[jobDate] || (rawCounter[jobDate] = [])).push({
      timeSubmit: job.submitTimestamp,
      timeStart: job.startTimestamp,
      timeEnd: job.endTimestamp,
      type: job.buildType,
      status: job.status,
    });
    if (job.status !== 'done' && job.status !== 'failed') {
      stable = false;
    }
  }
  const counter = ensureCounterFashion(rawCounter);
  cache = {
    counter,
    stable,
    time: moment(),
    lastJobId: JobPool.lastJobId,
  };
  return counter;
}

export default (ctx: Context) => {
  if (SERVER_STATUS_API_ENABLED === false) {
    ctx.status = 403;
    ctx.body = 'This api is disabled by config';
    return;
  }
  const currentAvailable = Builder.builderAvailable;

  if (cache !== null && cache.stable && cache.lastJobId === JobPool.lastJobId) {
    // if cache out of "date", fashionize it
    if (cache.time.format(DATE_FORMAT) !== moment().format(DATE_FORMAT)) {
      cache.counter = ensureCounterFashion(cache.counter);
      cache.time = moment();
    }
    ctx.body = {
      counter: cache.counter,
      currentAvailable,
      isUsingCache: true,
    };
  } else {
    ctx.body = {
      counter: generateCounter(),
      currentAvailable,
      isUsingCache: false,
      timeThisGenerated: Date.now(),
    };
  }

};

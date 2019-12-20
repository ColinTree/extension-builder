import Job from './Job.class';

export default class JobPool {

  public static add (job: Job) {
    JobPool.pool.set(job.id, job);
    this._lastJobId = job.id;
  }
  public static get (jobId: string) {
    return JobPool.pool.get(jobId);
  }
  public static has (jobId: string) {
    return JobPool.pool.has(jobId);
  }

  public static getJobIds () {
    return JobPool.pool.keys();
  }

  // tslint:disable-next-line variable-name
  private static _lastJobId = '';
  public static get lastJobId () {
    return this._lastJobId;
  }

  private static pool = new Map<string, Job>();

}

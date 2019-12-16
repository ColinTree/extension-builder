import Job from './Job.class';

export default class JobPool {

  public static lastJobId = '';

  public static add (job: Job) {
    JobPool.pool.set(job.id, job);
    this.lastJobId = job.id;
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

  private static pool = new Map<string, Job>();

}

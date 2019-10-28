import Job from './Job.class';

export default class JobPool {

  public static add (job: Job) {
    JobPool.pool.set(job.id, job);
  }
  public static get (jobId: string): Job {
    return JobPool.pool.get(jobId);
  }
  public static has (jobId: string) {
    return JobPool.pool.has(jobId);
  }

  private static pool = new Map<string, Job>();

}

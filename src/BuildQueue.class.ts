import Builder from './Builder.class';
import Job from './Job.class';
import Queue from './utils/Queue.class';

export default class BuildQueue {

  public static enqueue (job: Job) {
    job.status = 'waiting';
    BuildQueue.queue.enqueue(job.id);
    console.timeLog(`Added job(${job.id})`);
    Builder.notify();
  }
  public static dequeue () {
    return BuildQueue.queue.dequeue();
  }
  public static isEmpty () {
    return BuildQueue.queue.isEmpty();
  }

  private static queue = new Queue<string>();

}

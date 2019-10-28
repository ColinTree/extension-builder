export default class Queue<T> {

  private elements: T[];

  public constructor () {
    this.elements = new Array<T>();
  }

  public enqueue (o: T) {
    this.elements.unshift(o);
  }
  public dequeue (): T {
    return this.elements.pop();
  }
  public size (): number {
    return this.elements.length;
  }
  public isEmpty (): boolean {
    return this.size() === 0;
  }

}

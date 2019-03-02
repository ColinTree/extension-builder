export default class Queue<T> {

  private elements: Array<T>;

  public constructor() {
    this.elements = new Array<T>();
  }

  public push(o: T) {
    this.elements.unshift(o);
  }

  public pop(): T {
    return this.elements.pop();
  }

  public size(): number {
    return this.elements.length;
  }

  public isEmpty(): boolean {
    return this.size() == 0;
  }

  public clear() {
    delete this.elements;
    this.elements = new Array<T>();
  }
}
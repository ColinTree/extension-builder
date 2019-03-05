import { exec } from "shelljs";

/**
 * Execute a command with promise returns
 * @param command
 * @returns a Promise.
 *    With then(stdout => {execute when result code is 0})
 *    and catch((response = [code, stderr]) => {execute when code other than 0 returned})
 */
export default (command: string, silent = false) => {
  return new Promise<string>((resolve, reject) => {
    exec(command, { silent: silent }, (code, stdout, stderr) => {
      if (code == 0) {
        resolve(stdout);
      } else {
        reject(new ExecError(code, stdout, stderr));
      }
    });
  });
}
export class ExecError extends Error {
  private _code: number;
  private _stdout: string;
  private _stderr: string;
  constructor(code: number, stdout: string, stderr: string) {
    super("Command executing error occured");
    this._code = code;
    this._stdout = stdout;
    this._stderr = stderr;
  }
  get code() {
    return this._code;
  }
  get stdout() {
    return this._stdout;
  }
  get stderr() {
    return this._stderr;
  }
}
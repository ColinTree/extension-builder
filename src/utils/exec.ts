import { exec, ExecOutputReturnValue } from 'shelljs';

export default (command: string, silent = false) => new Promise((resolve, reject) => {
  exec(command, { silent: silent }, (code, stdout, stderr) => {
    if (code == 0) {
      resolve(stdout);
    } else {
      reject(new ExecError({ code, stdout, stderr }));
    }
  });
})
export class ExecError extends Error {
  private _execOutputReturnValue: ExecOutputReturnValue;
  constructor(execOutputReturnValue: ExecOutputReturnValue) {
    super('Command executing error occured');
    this._execOutputReturnValue = execOutputReturnValue;
  }
  get code() {
    return this._execOutputReturnValue.code;
  }
  get stdout() {
    return this._execOutputReturnValue.stdout;
  }
  get stderr() {
    return this._execOutputReturnValue.stderr;
  }
}
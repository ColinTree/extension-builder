import { exec, ExecOutputReturnValue } from 'shelljs';

export default async (command: string, silent = false) => {
  let result = <ExecOutputReturnValue> exec(command, {
    silent: silent,
    async: false // ensure it returns ExecOutputReturnValue
  });
  if (result.code == 0) {
    return result.stdout;
  } else {
    throw new ExecError(result);
  }
}
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
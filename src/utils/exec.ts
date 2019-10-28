import { exec, ExecOutputReturnValue } from 'shelljs';

export default (command: string, silent = false) => new Promise((resolve, reject) => {
  exec(command, { silent }, (code, stdout, stderr) => {
    if (code === 0) {
      resolve(stdout);
    } else {
      reject(new ExecError({ code, stdout, stderr }));
    }
  });
});
export class ExecError extends Error {

  private readonly execOutputReturnValue: ExecOutputReturnValue;

  constructor (execOutputReturnValue: ExecOutputReturnValue) {
    super('Command executing error occured');
    this.execOutputReturnValue = execOutputReturnValue;
  }

  get code () {
    return this.execOutputReturnValue.code;
  }
  get stdout () {
    return this.execOutputReturnValue.stdout;
  }
  get stderr () {
    return this.execOutputReturnValue.stderr;
  }

}

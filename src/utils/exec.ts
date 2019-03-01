import { exec } from "shelljs";

/**
 * Execute a command with promise returns
 * @param command
 * @returns a Promise.
 *    With then(stdout => {execute when result code is 0})
 *    and catch((response = [code, stderr]) => {execute when code other than 0 returned})
 */
export default (command: string) => {
  return new Promise((resolve, reject) => {
    exec(command, (code, stdout, stderr) => {
      if (code == 0) {
        resolve(stdout);
      } else {
        reject([code, stderr]);
      }
    });
  });
}
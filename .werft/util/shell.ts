import * as shell from 'shelljs';
import * as fs from 'fs';
import { ChildProcess } from 'child_process';
import { getGlobalWerftInstance } from './werft';

export type ExecOptions = shell.ExecOptions & {
    slice?: string;
    dontCheckRc?: boolean;
};
export type ExecResult = {
    code: number;
    stdout: string;
    stderr: string;
};

// exec executes a command and throws an exception if that command exits with a non-zero exit code
export function exec(command: string): shell.ShellString;
export function exec(command: string, options: ExecOptions & { async?: false }): shell.ShellString;
export function exec(command: string, options: ExecOptions & { async: true }): Promise<ExecResult>;
export function exec(command: string, options: ExecOptions): shell.ShellString | ChildProcess;
export function exec(cmd: string, options?: ExecOptions): ChildProcess | shell.ShellString | Promise<ExecResult> {
    const werft = getGlobalWerftInstance()

    if (options && options.slice) {
        options.silent = true;
    }

    const handleResult = (result, options) => {
        let output = [];
        if(result.stdout) {
            output.push("STDOUT: " + result.stdout);
        }
        if(result.stderr) {
            output.push("STDERR: " + result.stderr);
        }
        if (options && options.slice) {
            werft.logOutput(options.slice, output.join("\n"));
            output = []; // don't show the same output as part of the exception again.
        }
        if ((!options || !options.dontCheckRc) && result.code !== 0) {
            output.unshift(`${cmd} exit with non-zero status code.`)
            throw new Error(output.join("\n"));
        }
    };

    if (options && options.async) {
        return new Promise<ExecResult>((resolve, reject) => {
            shell.exec(cmd, options, (code, stdout, stderr) => {
                try {
                    const result: ExecResult = { code, stdout, stderr };
                    handleResult(result, options);
                    resolve(result);
                } catch (err) {
                    reject(err)
                }
            });
        });
    } else {
        const result = shell.exec(cmd, options);
        handleResult(result, options);
        return result;
    }
}

// gitTag tags the current state and pushes that tag to the repo origin
export const gitTag = (tag) => {
    shell.mkdir("/root/.ssh")
    fs.writeFileSync("/root/.ssh/config", `Host github.com
    UserKnownHostsFile=/dev/null
    StrictHostKeyChecking no
    IdentitiesOnly yes
    IdentityFile /mnt/secrets/github-ssh-key/github-ssh-key.pem`)
    shell.chmod(600, '/root/.ssh/*')
    shell.chmod(700, '/root/.ssh')

    exec("git config --global url.ssh://git@github.com/.insteadOf https://github.com/")
    exec(`git tag -f ${tag}`)
    exec(`git push -f origin ${tag}`)
}

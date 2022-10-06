import * as shell from "shelljs";
import * as fs from "fs";
import { ChildProcess } from "child_process";
import { getGlobalWerftInstance } from "./werft";

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
    const werft = getGlobalWerftInstance();

    if (options && options.slice) {
        options.silent = true;
    }

    const handleResult = (result, options) => {
        let output = [];
        if (result.stdout) {
            output.push("STDOUT: " + result.stdout);
        }
        if (result.stderr) {
            output.push("STDERR: " + result.stderr);
        }
        if (options && options.slice) {
            werft.logOutput(options.slice, output.join("\n"));
            output = []; // don't show the same output as part of the exception again.
        }
        if ((!options || !options.dontCheckRc) && result.code !== 0) {
            output.unshift(`${cmd} exit with non-zero status code.`);
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
                    reject(err);
                }
            });
        });
    } else {
        const result = shell.exec(cmd, options);
        handleResult(result, options);
        return result;
    }
}

/**
 * Execute a command and stream output logs.
 *
 * If a slice is given logs are streamed using the werft log syntax; else they're streamed directly
 * to stderr/stdout.
 */
export async function execStream(command: string, options: ExecOptions ): Promise<ExecResult> {
    const werft = getGlobalWerftInstance();

    options = options || {};

    if (options.slice) {
        options.silent = true;
    }

    const child = shell.exec(command, {...options, async: true});

    let stdout = '';
    let stderr = '';

    // note: the stdout/stderr event handlers aren't guaranteed to receive buffers that are always
    // newline terminated. The original log messages can be preserved by finding the index of the
    // last newline, printing up until that newline, buffering the remaining message, appending
    // to that buffer on the next call, and finally flushing the buffers then the process exits.
    child.stdout.on('data', (data) => {
        if (options.slice) werft.logOutput(options.slice, data.trim());
        stdout += data;
    });

    child.stderr.on('data', (data) => {
        if (options.slice) werft.logOutput(options.slice, data.trim());
        stderr += data;
    });

    const code = await new Promise<number>((resolve, reject) => {
        child.on('close', (code) => {
            if (typeof code === "number") {
                resolve(code);
            } else if (options.dontCheckRc) {
                // The process was terminated by a signal but we can tolerate a non-zero exit code.
                let msg = `\nTerminated with signal ${code}`;
                if (options.slice) {
                    werft.logOutput(options.slice, msg);
                } else {
                    console.error(msg);
                }
                // In the most strict of terms we should be doing 128 + signum, but childprocess
                // is returning the name of the signal that terminated the subprocess, not the signal
                // number itself. For now it'll suffice to return 128; printing an error message
                // and an usual exit code will be sufficient to support diagnostics of killed processes.
                resolve(128);
            } else {
                reject(new Error(`Process terminated with signal ${code}`))
            }
        });
    });

    return { code, stdout, stderr };
}

// gitTag tags the current state and pushes that tag to the repo origin
export const gitTag = (tag) => {
    shell.mkdir("/root/.ssh");
    fs.writeFileSync(
        "/root/.ssh/config",
        `Host github.com
    UserKnownHostsFile=/dev/null
    StrictHostKeyChecking no
    IdentitiesOnly yes
    IdentityFile /mnt/secrets/github-ssh-key/github-ssh-key.pem`,
    );
    shell.chmod(600, "/root/.ssh/*");
    shell.chmod(700, "/root/.ssh");

    exec("git config --global url.ssh://git@github.com/.insteadOf https://github.com/");
    exec(`git tag -f ${tag}`);
    exec(`git push -f origin ${tag}`);
};

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, named } from 'inversify';
import { ILogger } from '@theia/core/lib/common';
import { ProcessManager, MultiRingBuffer, TerminalProcess, TerminalProcessOptions } from '@theia/process/lib/node';
import { ShellProcessOptions } from '@theia/terminal/lib/node/shell-process';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { FileUri } from '@theia/core/lib/node';
import URI from '@theia/core/lib/common/uri';

@injectable()
export class GitpodShellProcess extends TerminalProcess {

    protected static defaultCols = 80;
    protected static defaultRows = 24;

    // Buffer writes until the terminal signals it's ready (by emitting data the first time: the prompt)
    protected readonly ready = new Deferred<string>();
    protected readyFlag: boolean = false;
    protected beforeReadyBuffer: string[] = [];

    constructor(
        @inject(ShellProcessOptions) options: ShellProcessOptions,
        @inject(ProcessManager) processManager: ProcessManager,
        @inject(MultiRingBuffer) protected readonly ringBuffer: MultiRingBuffer,
        @inject(ILogger) @named('process') logger: ILogger) {
        super(<TerminalProcessOptions>{
            command: '/bin/bash',
            args: [ '-i' ],
            options: {
                name: 'xterm-color',
                cols: options.cols || GitpodShellProcess.defaultCols,
                rows: options.rows || GitpodShellProcess.defaultRows,
                cwd: FileUri.fsPath(new URI(options.rootURI || process.env.THEIA_WORKSPACE_ROOT)),
                env: GitpodShellProcess.getEnvs(options.env || {}),
            }
        }, processManager, ringBuffer, logger);

        this.ready.promise.then(data => {
            this.readyFlag = true;
            this.logger.info(`Terminal process ${this.id} ready: ${data}`);
            for (const str of this.beforeReadyBuffer) {
                super.write(str);
            }
            this.beforeReadyBuffer = [];
        });

        if (this.terminal) {
            this.terminal.on('data', (data: string) => {
                this.ready.resolve(data);
            });
        }
    }

    write(data: string): void {
        if (!this.readyFlag) {
            this.beforeReadyBuffer.push(data);
            return;
        }
        super.write(data);
    }

}

export namespace GitpodShellProcess {
    export function getEnvs(customEnvs: { [key: string]: string | null }): { [key: string]: string } {
        const envs: { [key: string]: string } = {};
        for (const name of Object.getOwnPropertyNames(customEnvs)) {
            envs[name] = customEnvs[name] || "";
        }

        const processEnv: { [key: string]: string } = {};
        const prEnv: NodeJS.ProcessEnv = process.env;
        Object.keys(prEnv).forEach((key: string) => {
            processEnv[key] = prEnv[key] || '';
        });
        for (const name of Object.getOwnPropertyNames(processEnv)) {
            envs[name] = processEnv[name] || "";
        }
        console.log(`shell envs: ` + JSON.stringify(envs));
        return envs;
    }
}
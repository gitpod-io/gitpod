/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ITerminalServiceClient } from '@gitpod/supervisor-api-grpc/lib/terminal_grpc_pb';
import { CloseTerminalRequest, ListenTerminalRequest, ListenTerminalResponse, SetTerminalSizeRequest, WriteTerminalRequest } from '@gitpod/supervisor-api-grpc/lib/terminal_pb';
import { ILogger } from '@theia/core/lib/common/logger';
import { MultiRingBuffer, ProcessErrorEvent, ProcessManager } from '@theia/process/lib/node';
import { TerminalProcess } from '@theia/process/lib/node/terminal-process';
import { inject, injectable, named } from 'inversify';
import { SupervisorClientProvider } from './supervisor-client-provider';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { timeout } from '@theia/core/lib/common/promise-util';

@injectable()
export class GitpodTaskTerminalProcessOptions {
    id: string
}

export const GitpodTaskTerminalProcessFactory = Symbol('GitpodTaskTerminalProcessFactory');
export interface GitpodTaskTerminalProcessFactory {
    (options: GitpodTaskTerminalProcessOptions): GitpodTaskTerminalProcess
}

@injectable()
export class GitpodTaskTerminalProcess extends TerminalProcess {

    private alias?: string;

    private readonly client: ITerminalServiceClient;

    constructor(
        @inject(GitpodTaskTerminalProcessOptions) options: GitpodTaskTerminalProcessOptions,
        @inject(ProcessManager) processManager: ProcessManager,
        @inject(MultiRingBuffer) ringBuffer: MultiRingBuffer,
        @inject(ILogger) @named('terminal') logger: ILogger,
        @inject(SupervisorClientProvider) clientProvider: SupervisorClientProvider
    ) {
        super({
            command: options.id,
            isPseudo: true
        }, processManager, ringBuffer, logger);
        this.client = clientProvider.getTerminalClient();
    }

    async listen(alias: string): Promise<void> {
        if (this.alias) {
            return;
        }
        this.alias = alias;
        this.emitOnStarted();
        while (this.alias) {
            await new Promise(resolve => {
                try {
                    const request = new ListenTerminalRequest();
                    request.setAlias(alias);
                    const stream = this.client.listen(request);
                    stream.on('close', resolve);
                    stream.on('end', () => {
                        this.alias = undefined;
                        this.emitOnExit();
                        process.nextTick(() => {
                            this.emitOnClose();
                        });
                        resolve();
                    });
                    stream.on('error', (e: ProcessErrorEvent) => {
                        this.alias = undefined;
                        this.emitOnError(e);
                        resolve();
                    });
                    stream.on('data', (response: ListenTerminalResponse) => {
                        let str = '';
                        for (const buffer of [response.getStdout(), response.getStderr()]) {
                            if (typeof buffer === 'string') {
                                str += buffer;
                            } else {
                                str += BinaryBuffer.wrap(buffer).toString()
                            }
                        }
                        if (str !== '') {
                            this.ringBuffer.enq(str);
                        }
                    });
                } catch (e) {
                    resolve();
                }
            });
            await timeout(2000);
        }
    }

    kill(): void {
        if (!this.alias) {
            return;
        }
        const request = new CloseTerminalRequest();
        request.setAlias(this.alias);
        this.client.close(request, e => {
            if (e) {
                console.error(`[${this.alias}] failed to kill the gitpod task terminal:`, e);
            }
        });
    }

    resize(cols: number, rows: number): void {
        if (!this.alias) {
            return;
        }
        const request = new SetTerminalSizeRequest();
        request.setAlias(this.alias);
        request.setCols(cols);
        request.setRows(rows);
        request.setForce(true);
        this.client.setSize(request, e => {
            if (e) {
                console.error(`[${this.alias}] failed to resize the gitpod task terminal:`, e);
            }
        });
    }

    write(data: string): void {
        if (!this.alias) {
            return;
        }
        const request = new WriteTerminalRequest();
        request.setAlias(this.alias);
        request.setStdin(BinaryBuffer.fromString(data).buffer);
        this.client.write(request, e => {
            if (e) {
                console.error(`[${this.alias}] failed to write to the gitpod task terminal:`, e);
            }
        });
    }

}
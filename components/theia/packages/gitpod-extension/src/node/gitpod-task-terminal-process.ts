/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ServiceError, status } from '@grpc/grpc-js';
import { ITerminalServiceClient } from '@gitpod/supervisor-api-grpc/lib/terminal_grpc_pb';
import { ShutdownTerminalRequest, ListenTerminalRequest, ListenTerminalResponse, SetTerminalSizeRequest, TerminalSize, WriteTerminalRequest } from '@gitpod/supervisor-api-grpc/lib/terminal_pb';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import { ILogger } from '@theia/core/lib/common/logger';
import { timeout } from '@theia/core/lib/common/promise-util';
import { MultiRingBuffer, ProcessManager } from '@theia/process/lib/node';
import { TerminalProcess } from '@theia/process/lib/node/terminal-process';
import { inject, injectable, named } from 'inversify';
import { SupervisorClientProvider } from './supervisor-client-provider';
import { ProcessErrorEvent } from '@theia/process/src/node/process'

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
            try {
                await new Promise((resolve, reject) => {
                    const request = new ListenTerminalRequest();
                    request.setAlias(alias);
                    const stream = this.client.listen(request);
                    stream.on('close', resolve);
                    stream.on('end', resolve);
                    stream.on('error', (e: ServiceError) => {
                        if (e.code === status.NOT_FOUND) {
                            this.alias = undefined;
                            resolve();
                            this.emitOnError(e as any as ProcessErrorEvent);
                            stream.cancel();
                        } else {
                            reject(e);
                        }
                    });
                    stream.on('data', (response: ListenTerminalResponse) => {
                        if (response.hasData()) {
                            let str = '';
                            const buffer = response.getData();
                            if (typeof buffer === 'string') {
                                str += buffer;
                            } else {
                                str += BinaryBuffer.wrap(buffer).toString()
                            }
                            if (str !== '') {
                                this.ringBuffer.enq(str);
                            }
                        } else if (response.hasExitCode()) {
                            this.alias = undefined;
                            resolve();
                            const exitCode = response.getExitCode();
                            this.emitOnExit(exitCode);
                            process.nextTick(() => {
                                this.emitOnClose(exitCode);
                            });
                            stream.cancel();
                        }
                    });
                });
            } catch (e) {
                console.error(`[${this.alias}] listening to the gitpod task terminal failed:`, e);
            }
            await timeout(2000);
        }
    }

    kill(): void {
        if (!this.alias) {
            return;
        }
        const request = new ShutdownTerminalRequest();
        request.setAlias(this.alias);
        this.client.shutdown(request, e => {
            if (e && (e as any as ServiceError).code !== status.NOT_FOUND) {
                console.error(`[${this.alias}] failed to kill the gitpod task terminal:`, e);
            }
        });
    }

    resize(cols: number, rows: number): void {
        if (!this.alias) {
            return;
        }
        const size = new TerminalSize();
        size.setCols(cols);
        size.setRows(rows);

        const request = new SetTerminalSizeRequest();
        request.setAlias(this.alias);
        request.setSize(size);
        request.setForce(true);
        this.client.setSize(request, e => {
            if (e && (e as any as ServiceError).code !== status.NOT_FOUND) {
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
            if (e && (e as any as ServiceError).code !== status.NOT_FOUND) {
                console.error(`[${this.alias}] failed to write to the gitpod task terminal:`, e);
            }
        });
    }

}
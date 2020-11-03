/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TasksStatusRequest, TasksStatusResponse } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { JsonRpcProxy } from '@theia/core/lib/common/messaging/proxy-factory';
import { ApplicationShell } from '@theia/core/lib/browser';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { ProcessManager, TerminalProcess } from '@theia/process/lib/node';
import * as fs from 'fs';
import { inject, injectable, postConstruct } from 'inversify';
import * as path from 'path';
import * as util from 'util';
import { AttachTaskTerminalParams, GitpodTask, GitpodTaskClient, GitpodTaskServer } from '../common/gitpod-task-protocol';
import { SupervisorClientProvider } from './supervisor-client-provider';
import psTree = require('ps-tree');

@injectable()
export class GitpodTaskServerImpl implements GitpodTaskServer {

    protected run = true;
    protected stopUpdates: (() => void) | undefined;

    private readonly clients = new Set<GitpodTaskClient>();

    private readonly tasks = new Map<string, GitpodTask>();
    private readonly deferredReady = new Deferred<void>();
    private readonly supervisorBin = (async () => {
        let supervisor = '/.supervisor/supervisor';
        try {
            await util.promisify(fs.stat)(supervisor);
        } catch (e) {
            supervisor = '/theia/supervisor';
            try {
                await util.promisify(fs.stat)(supervisor);
            } catch {
                throw e;
            }
        }
        return supervisor;
    })();

    @inject(ProcessManager)
    protected readonly processManager: ProcessManager;

    @inject(SupervisorClientProvider)
    private readonly supervisorClientProvider: SupervisorClientProvider;

    @postConstruct()
    async start(): Promise<void> {
        const client = await this.supervisorClientProvider.getStatusClient();
        while (this.run) {
            try {
                const req = new TasksStatusRequest();
                req.setObserve(true);
                const evts = client.tasksStatus(req);
                this.stopUpdates = evts.cancel;

                await new Promise((resolve, reject) => {
                    evts.on("close", resolve);
                    evts.on("error", reject);
                    evts.on("data", (response: TasksStatusResponse) => {
                        const updated: GitpodTask[] = [];
                        for (const task of response.getTasksList()) {
                            const openIn = task.getPresentation()!.getOpenIn();
                            const openMode = task.getPresentation()!.getOpenMode();
                            const update: GitpodTask = {
                                id: task.getId(),
                                state: task.getState() as number,
                                terminal: task.getTerminal(),
                                presentation: {
                                    name: task.getPresentation()!.getName(),
                                    // grpc inserts empty strings for optional properties of string type :(
                                    openIn: !!openIn ? openIn as ApplicationShell.WidgetOptions['area'] | undefined : undefined,
                                    openMode: !!openMode ? openMode as ApplicationShell.WidgetOptions['mode'] | undefined : undefined
                                }
                            }
                            this.tasks.set(task.getId(), update);
                            updated.push(update);
                        }
                        for (const client of this.clients) {
                            client.onDidChange({ updated });
                        }
                        this.deferredReady.resolve();
                    });
                });
            } catch (err) {
                console.error("cannot maintain connection to supervisor", err);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async attach({ terminalId, remoteTerminal }: AttachTaskTerminalParams): Promise<void> {
        const terminalProcess = this.processManager.get(terminalId);
        if (!(terminalProcess instanceof TerminalProcess)) {
            return;
        }
        const [supervisorBin, children] = await Promise.all([
            this.supervisorBin,
            util.promisify(psTree)(terminalProcess.pid)
        ]);
        const supervisorCommand = path.basename(supervisorBin);
        if (children.some(child => child.COMMAND === supervisorCommand)) {
            return;
        }
        terminalProcess.write(`${supervisorBin} terminal attach -ir ${remoteTerminal}\r\n`);
    }

    setClient(client: JsonRpcProxy<GitpodTaskClient>): void {
        let closed = false;
        this.deferredReady.promise.then(() => {
            if (closed) {
                return;
            }
            this.clients.add(client);
            client.onDidChange({
                updated: [...this.tasks.values()]
            })
        });
        client.onDidCloseConnection(() => {
            closed = true;
            this.clients.delete(client);
        });
    }

    dispose(): void {
        this.run = false;
        if (!!this.stopUpdates) {
            this.stopUpdates();
        }
    }

}
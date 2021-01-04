/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TasksStatusRequest, TasksStatusResponse } from '@gitpod/supervisor-api-grpc/lib/status_pb';
import { ApplicationShell } from '@theia/core/lib/browser';
import { JsonRpcProxy } from '@theia/core/lib/common/messaging/proxy-factory';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { ProcessManager } from '@theia/process/lib/node';
import { inject, injectable, postConstruct } from 'inversify';
import { GitpodTask, GitpodTaskClient, GitpodTaskServer, GitpodTaskState } from '../common/gitpod-task-protocol';
import { SupervisorClientProvider } from './supervisor-client-provider';
import { GitpodTaskTerminalProcess, GitpodTaskTerminalProcessFactory } from './gitpod-task-terminal-process';
import { ShellTerminalServer } from '@theia/terminal/lib/node/shell-terminal-server';
import { IShellTerminalServer } from '@theia/terminal/lib/common/shell-terminal-protocol';

@injectable()
export class GitpodTaskServerImpl implements GitpodTaskServer {

    private run = true;
    private stopUpdates: (() => void) | undefined;

    private readonly clients = new Set<GitpodTaskClient>();

    private readonly tasks = new Map<string, GitpodTask>();
    private readonly deferredReady = new Deferred<void>();

    @inject(SupervisorClientProvider)
    private readonly supervisorClientProvider: SupervisorClientProvider;

    @inject(ProcessManager)
    private readonly processManager: ProcessManager;

    @inject(GitpodTaskTerminalProcessFactory)
    private readonly processFactory: GitpodTaskTerminalProcessFactory;

    @inject(IShellTerminalServer)
    private readonly shellTerminalServer: ShellTerminalServer;

    private readonly processes = new Map<string, GitpodTaskTerminalProcess>();

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
                        }
                        this.updateProcesses();
                        this.deferredReady.resolve();
                    });
                });
            } catch (err) {
                console.error("cannot maintain connection to supervisor", err);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    protected updateProcesses(): void {
        for (const [id, task] of this.tasks) {
            let process = this.processes.get(id);
            if (task.state === GitpodTaskState.CLOSED) {
                if (process) {
                    process.kill();
                }
                continue;
            }
            if (!process) {
                const newProcess = this.processFactory({ id });
                this.shellTerminalServer['postCreate'](newProcess);
                this.processes.set(id, newProcess);
                const listener = this.processManager.onDelete(processId => {
                    if (newProcess.id === processId) {
                        this.processes.delete(id);
                        listener.dispose();
                    }
                })
                process = newProcess;
            }
            if (task.state === GitpodTaskState.RUNNING && task.terminal) {
                process.listen(task.terminal);
            }
        }
    }

    async getTasks(): Promise<GitpodTask[]> {
        await this.deferredReady.promise;
        return [...this.tasks.values()];
    }

    async attach(taskId: string): Promise<number> {
        await this.deferredReady.promise;
        const process = this.processes.get(taskId)
        return process ? process.id : -1;
    }

    setClient(client: JsonRpcProxy<GitpodTaskClient>): void {
        this.clients.add(client);
        client.onDidCloseConnection(() => {
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
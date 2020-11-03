/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalFrontendContribution } from '@theia/terminal/lib/browser/terminal-frontend-contribution';
import { IBaseTerminalServer } from '@theia/terminal/lib/common/base-terminal-protocol';
import { inject, injectable, postConstruct } from 'inversify';
import { GitpodTask, GitpodTaskServer, GitpodTaskState } from '../common/gitpod-task-protocol';
import { GitpodTerminalWidget } from './gitpod-terminal-widget';

interface GitpodTaskTerminalWidget extends GitpodTerminalWidget {
    readonly kind: 'gitpod-task'
    applyTask(updated: GitpodTask): Promise<void>
}
namespace GitpodTaskTerminalWidget {
    const idPrefix = 'gitpod-task-terminal'
    export function is(terminal: TerminalWidget): terminal is GitpodTaskTerminalWidget {
        return terminal.kind === 'gitpod-task';
    }
    export function toTerminalId(id: string): string {
        return idPrefix + ':' + id;
    }
    export function getTaskId(terminal: GitpodTaskTerminalWidget): string {
        return terminal.id.split(':')[1];
    }
}

@injectable()
export class GitpodTaskContribution implements FrontendApplicationContribution {

    @inject(TerminalFrontendContribution)
    private readonly terminals: TerminalFrontendContribution;

    @inject(GitpodTaskServer)
    private readonly server: GitpodTaskServer;

    private readonly taskTerminals = new Map<string, GitpodTaskTerminalWidget>();

    private readonly pendingInitialTasks = new Deferred<GitpodTask[]>();
    private readonly pendingInitializeLayout = new Deferred<void>();
    private updateQueue = this.pendingInitializeLayout.promise;

    @postConstruct()
    protected init(): void {
        // register client before connection is opened
        this.server.setClient({
            onDidChange: ({ updated }) => {
                this.pendingInitialTasks.resolve(updated);
                this.queue(() => this.updateTerminals(updated));
            }
        });
        this.terminals.onDidCreateTerminal(terminal => {
            if (GitpodTaskTerminalWidget.is(terminal)) {
                this.taskTerminals.set(terminal.id, terminal);
                terminal.onDidDispose(() =>
                    this.taskTerminals.delete(terminal.id)
                );
                const attachTerminal = terminal['attachTerminal'].bind(terminal);
                terminal['attachTerminal'] = id => attachTerminal(id).then(terminalId => {
                    if (IBaseTerminalServer.validateId(terminalId)) {
                        return terminalId
                    }
                    return terminal['createTerminal']()
                })
                let starting = false;
                const start = terminal['start'].bind(terminal);
                terminal['start'] = async id => {
                    starting = true;
                    try {
                        return start(id)
                    } finally {
                        starting = false;
                    }
                }

                let task: GitpodTask | undefined;
                const update = async () => {
                    if (task?.state === GitpodTaskState.CLOSED) {
                        terminal.dispose();
                        return;
                    }
                    const remoteTerminal = task?.terminal;
                    if (task?.state !== GitpodTaskState.RUNNING || !remoteTerminal || starting) {
                        return;
                    }
                    const terminalId = terminal.terminalId;
                    if (IBaseTerminalServer.validateId(terminalId)) {
                        await this.server.attach({ terminalId, remoteTerminal });
                    } else {
                        await terminal.start();
                    }
                }
                terminal.applyTask = updated => {
                    task = updated
                    return update()
                }
                terminal.onTerminalDidClose(() => {
                    if (task && task.terminal && task.state !== GitpodTaskState.CLOSED) {
                        fetch(window.location.protocol + '//' + window.location.host + '/_supervisor/v1/terminal/close/' + task.terminal, {
                            credentials: "include"
                        })
                    }
                });
                terminal.onDidOpen(update)
                terminal.onDidOpenFailure(update);
            }
        });
    }

    async onDidInitializeLayout(): Promise<void> {
        const tasks = await this.pendingInitialTasks.promise;
        let ref: TerminalWidget | undefined;
        for (const task of tasks) {
            if (task.state == GitpodTaskState.CLOSED) {
                continue;
            }
            try {
                const id = GitpodTaskTerminalWidget.toTerminalId(task.id);
                let terminal = this.taskTerminals.get(id);
                if (!terminal) {
                    terminal = (await this.terminals.newTerminal({
                        id,
                        kind: 'gitpod-task',
                        title: task.presentation!.name,
                        useServerTitle: false
                    })) as GitpodTaskTerminalWidget;
                    this.terminals.activateTerminal(terminal, {
                        ref,
                        area: task.presentation.openIn || 'bottom',
                        mode: task.presentation.openMode || 'tab-after'
                    });
                }
                ref = terminal;
            } catch (e) {
                console.error('Failed to start Gitpod task terminal:', e);
            }
        }
        this.pendingInitializeLayout.resolve();

        // if there is no terminal at all, lets start one
        if (!this.terminals.all.length) {
            const terminal = await this.terminals.newTerminal({});
            terminal.start();
            this.terminals.open(terminal);
        }
    }

    private async updateTerminals(tasks: GitpodTask[]): Promise<void> {
        for (const task of tasks) {
            try {
                const id = GitpodTaskTerminalWidget.toTerminalId(task.id);
                const terminal = this.taskTerminals.get(id);
                if (!terminal) {
                    continue;
                }
                await terminal.applyTask(task);
            } catch (e) {
                console.error('Failed to update Gitpod task terminal:', e);
            }
        }
    }

    private queue(update: () => Promise<void>): Promise<void> {
        return this.updateQueue = this.updateQueue.then(update, update);
    }

}
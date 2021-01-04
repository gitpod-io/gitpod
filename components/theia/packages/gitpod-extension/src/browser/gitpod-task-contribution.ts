/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { FrontendApplicationContribution, Widget, WidgetManager } from '@theia/core/lib/browser';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalFrontendContribution } from '@theia/terminal/lib/browser/terminal-frontend-contribution';
import { inject, injectable, postConstruct } from 'inversify';
import { GitpodTaskServer, GitpodTaskState } from '../common/gitpod-task-protocol';
import { GitpodTerminalWidget } from './gitpod-terminal-widget';

interface GitpodTaskTerminalWidget extends GitpodTerminalWidget {
    readonly kind: 'gitpod-task'
}
namespace GitpodTaskTerminalWidget {
    const idPrefix = 'gitpod-task-terminal'
    export function is(terminal: Widget): terminal is GitpodTaskTerminalWidget {
        return terminal instanceof GitpodTerminalWidget && terminal.kind === 'gitpod-task';
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

    @inject(WidgetManager)
    private readonly widgetManager: WidgetManager;

    @inject(GitpodTaskServer)
    private readonly server: GitpodTaskServer;

    @postConstruct()
    protected init(): void {
        this.widgetManager.onWillCreateWidget(event => {
            const terminal = event.widget;
            if (GitpodTaskTerminalWidget.is(terminal)) {
                terminal['createTerminal'] = () => {
                    const taskId = GitpodTaskTerminalWidget.getTaskId(terminal);
                    return this.server.attach(taskId);
                }
                terminal['attachTerminal'] = () => {
                    const taskId = GitpodTaskTerminalWidget.getTaskId(terminal);
                    return this.server.attach(taskId);
                }
                terminal.onDidOpenFailure(() => terminal.dispose());
            }
        });
    }

    async onDidInitializeLayout(): Promise<void> {
        const tasks = await this.server.getTasks()

        const taskTerminals = new Map<string, GitpodTaskTerminalWidget>();
        for (const terminal of this.terminals.all) {
            if (GitpodTaskTerminalWidget.is(terminal)) {
                taskTerminals.set(terminal.id, terminal);
            }
        }

        let ref: TerminalWidget | undefined;
        for (const task of tasks) {
            if (task.state == GitpodTaskState.CLOSED) {
                continue;
            }
            try {
                const id = GitpodTaskTerminalWidget.toTerminalId(task.id);
                let terminal = taskTerminals.get(id);
                if (!terminal) {
                    terminal = (await this.terminals.newTerminal({
                        id,
                        kind: 'gitpod-task',
                        title: task.presentation!.name,
                        useServerTitle: false,
                        destroyTermOnClose: true,
                    })) as GitpodTaskTerminalWidget;
                    terminal.start();
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

        // if there is no terminal at all, lets start one
        if (!this.terminals.all.length) {
            const terminal = await this.terminals.newTerminal({});
            terminal.start();
            this.terminals.open(terminal);
        }
    }

}
/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ShellLayoutRestorer, WidgetManager, StorageService, FrontendApplication, ApplicationShell } from "@theia/core/lib/browser";
import { injectable, inject } from "inversify";
import { ILogger } from "@theia/core";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { GitpodInfoService, TerminalProcessInfo } from "../common/gitpod-info";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { TerminalWidget } from "@theia/terminal/lib/browser/base/terminal-widget";
import { TERMINAL_WIDGET_FACTORY_ID, TerminalWidgetFactoryOptions } from '@theia/terminal/lib/browser/terminal-widget-impl';
import { WorkspaceService } from "@theia/workspace/lib/browser";
import { TaskConfig } from "@gitpod/gitpod-protocol";
import { GitpodTerminalWidget } from "./gitpod-terminal-widget";
import { getWorkspaceID } from "./utils";

const workspaceIdPlaceHolder = '<§wsid$>';

function replaceAll(origin: string, replace: string, withThis: string): string {
    return origin.split(replace).join(withThis);
}

@injectable()
export class GitpodLayoutRestorer extends ShellLayoutRestorer {

    private layoutData = new Deferred<string | undefined>();
    protected application: FrontendApplication;
    private cwd: string | undefined;

    constructor(
        @inject(WidgetManager) protected widgetManager: WidgetManager,
        @inject(ILogger) protected logger: ILogger,
        @inject(StorageService) protected storageService: StorageService,
        @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider,
        @inject(GitpodInfoService) protected infoProvider: GitpodInfoService,
        @inject(WorkspaceService) protected workspaceService: WorkspaceService
        ) {
        super(widgetManager, logger, storageService);
        const service = this.serviceProvider.getService()
        const workspaceId = getWorkspaceID();
        service.server.getLayout({workspaceId}).then(layout => {
            // update placeholders with new workspace id
            const replaced = layout && replaceAll(layout, workspaceIdPlaceHolder, workspaceId);
            this.layoutData.resolve(replaced);
        });
        
    }

    public captureLayout(): string {
        const layoutData = this.application.shell.getLayoutData();
        const layoutDataAsString = this.deflate(layoutData);
        // replace workspace id occurrences (e.g. preview) with ws id placeholder markers
        return replaceAll(layoutDataAsString, getWorkspaceID(), workspaceIdPlaceHolder);
    }

    public async restoreLayout(app: FrontendApplication): Promise<boolean> {
        this.application = app;
        const restored =  await super.restoreLayout(app);
        try {
            if (!restored) {
                const serializedLayoutData = await this.layoutData.promise;
                if (!serializedLayoutData) {
                    return false;
                }
                const layoutData = await this.inflate(serializedLayoutData);
                await app.shell.setLayoutData(layoutData);
                return true;
            }
            return restored;
        } finally {
            this.initializeTerminals(app.shell);
        }
    }


    protected async initializeTerminals(shell: ApplicationShell) {
        const infos = await this.infoProvider.getTerminalProcessInfos();
        const roots = await this.workspaceService.roots;
        this.cwd = roots[0] && roots[0].resource.path.toString() || undefined;
        this.doInitializeTerminals(shell, infos);
    }

    protected doInitializeTerminals(shell: ApplicationShell, infos: TerminalProcessInfo[]) {
        interface TerminalConnection {
            processId?: number,
            info?: TerminalProcessInfo,
            terminal?: TerminalWidget
        }
        const terminals: GitpodTerminalWidget[] = shell.widgets.filter(w => w instanceof GitpodTerminalWidget).map(t => t as GitpodTerminalWidget);
        const usedTerminals = new Set();
        const allConnections : TerminalConnection[] = [];

        for (const info of infos) {
            allConnections.push({
                processId: info.processId,
                info
            })
        }
        // associate direct matches by processid
        for (const terminal of terminals) {
            const processId = (terminal as GitpodTerminalWidget).getTerminalId();
            if (processId !== undefined) {
                let connection = allConnections.find(i => i.processId === processId);
                if (connection && !connection.terminal) {
                    connection.terminal = terminal;
                    usedTerminals.add(terminal);
                }
            }
        }
        // associate other terminals
        for (const terminal of terminals) {
            if (!usedTerminals.has(terminal)) {
                const connection = allConnections.find(con => !con.terminal)
                if (connection) {
                    connection.terminal = terminal;
                } else {
                    const processId = (terminal as GitpodTerminalWidget).getTerminalId();
                    allConnections.push({
                        processId,
                        terminal
                    });
                }
            }
        }
        // start all
        for (const c of allConnections) {
            if (c.info && c.terminal) {
                c.terminal.start(c.info.processId);
                c.terminal.title.label = this.computeTitle(c.info.task);
            } else if (c.info) {
                const options: ApplicationShell.WidgetOptions = {
                    area: c.info.task.openIn || 'bottom',
                    mode: c.info.task.openMode || 'tab-after'
                }
                const title = this.computeTitle(c.info.task);
                this.newTerminalFor(shell, c.info.processId, options, title);
            } else if (c.terminal) {
                c.terminal.start();
                c.terminal.title.label = this.computeTitle();
            }
        }
        // if there is no terminal at all, lets start one
        if (terminals.length === 0 && infos.length === 0) {
            const title = this.computeTitle();
            this.newTerminalFor(shell, 0, { area: 'bottom' }, title);
        }
    }

    protected computeTitle(task?: TaskConfig): string {
        if (task && task.name) {
            return task.name;
        }
        return this.cwd || 'Terminal';
    }

    protected async newTerminalFor(shell: ApplicationShell, processId: number, openOptions: ApplicationShell.WidgetOptions, title: string): Promise<void> {
        const widget = <TerminalWidget>await this.widgetManager.getOrCreateWidget(TERMINAL_WIDGET_FACTORY_ID, <TerminalWidgetFactoryOptions>{
            title,
            useServerTitle: false,
            created: new Date().toISOString()
        });
        shell.addWidget(widget, openOptions);
        shell.activateWidget(widget.id);
        //  If a backend process with this id is there it will use it. Or create a fresh one.
        widget.start(processId);
    }
}

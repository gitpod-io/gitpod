/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MessageService } from "@theia/core";
import { AbstractViewContribution, FrontendApplicationContribution, StatusBar, StatusBarAlignment } from "@theia/core/lib/browser";
import { WindowService } from "@theia/core/lib/browser/window/window-service";
import { PROBLEM_KIND } from "@theia/markers/lib/common/problem-marker";
import { MiniBrowserOpenHandler } from "@theia/mini-browser/lib/browser/mini-browser-open-handler";
import { inject, postConstruct } from "inversify";
import { GitpodPortViewWidget, PORT_WIDGET_FACTORY_ID } from "./gitpod-port-view-widget";
import { ExposedServedPort, GitpodPortsService, isExposedServedPort } from "./gitpod-ports-service";
import { PortVisibility, OnPortExposedAction } from "@gitpod/supervisor-api-grpc/lib/status_pb";

export namespace PORT_COMMANDS {
    export const SHOW_VIEW = {
        id: 'ports.show_view',
    };
}

export class GitpodPortViewContribution extends AbstractViewContribution<GitpodPortViewWidget> implements FrontendApplicationContribution {
    static PORTS_OPEN_PORTS = 'ports-open';

    @inject(MiniBrowserOpenHandler) private readonly miniBrowserOpenHandler: MiniBrowserOpenHandler;
    @inject(GitpodPortsService) private readonly portsService: GitpodPortsService;
    @inject(StatusBar) private readonly statusBar: StatusBar;
    @inject(MessageService) private readonly messageService: MessageService;
    @inject(WindowService) private readonly windowService: WindowService;

    private readonly currentNotifications = new Set<number>();

    constructor() {
        super({
            widgetId: PORT_WIDGET_FACTORY_ID,
            widgetName: GitpodPortViewWidget.LABEL,
            defaultWidgetOptions: {
                area: 'bottom',
                rank: 200,
            },
            toggleCommandId: PORT_COMMANDS.SHOW_VIEW.id
        });
    }

    @postConstruct()
    protected init(): void {
        this.updateStatusBar();
        this.portsService.onDidChange(() => this.updateStatusBar());
        this.portsService.onDidExposeServedPort(port => this.handleDidExposeServedPort(port));
    }

    async initializeLayout(): Promise<void> {
        const problemsWidget = await this.widgetManager.getWidget(PROBLEM_KIND);
        const ref = problemsWidget;
        await this.openView({
            mode: "tab-after",
            ref
        });
    }

    protected async handleDidExposeServedPort(port: ExposedServedPort): Promise<any> {
        if (port.exposed.onExposed === OnPortExposedAction.IGNORE) {
            return;
        }

        if (port.exposed.onExposed === OnPortExposedAction.OPEN_BROWSER) {
            return this.windowService.openNewWindow(port.exposed.url, {
                external: true
            });
        }

        if (port.exposed.onExposed === OnPortExposedAction.OPEN_PREVIEW) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return this.miniBrowserOpenHandler.openPreview(port.exposed.url);
        }

        if (port.exposed.onExposed === OnPortExposedAction.NOTIFY) {
            return this.showOpenServiceNotification(port);
        }

        if (port.exposed.onExposed === OnPortExposedAction.NOTIFY_PRIVATE) {
            return this.showOpenServiceNotification(port, port.exposed.visibility !== PortVisibility.PUBLIC);
        }
    }

    protected async showOpenServiceNotification(port: ExposedServedPort, offerMakePublic = false): Promise<void> {
        const localPort = port.localPort;
        if (this.currentNotifications.has(localPort)) {
            return;
        }

        // TODO It would be nice to have the following options here:
        //  - "Always Ignore"
        // see https://github.com/TypeFox/gitpod/issues/3892
        const makePublic = "Make Public";
        const openAction = "Open Preview";
        const openExternalAction = "Open Browser";
        const actions = offerMakePublic ? [makePublic, openAction, openExternalAction] : [openAction, openExternalAction];

        this.currentNotifications.add(localPort);
        const result = await this.messageService.info('A service is available on port ' + localPort, ...actions);
        this.currentNotifications.delete(localPort);

        const uri = port.exposed.url;

        if (result == makePublic) {
            await this.portsService.setVisibility(port, 'public');
        } else if (result == openAction) {
            await this.miniBrowserOpenHandler.openPreview(uri);
        } else if (result == openExternalAction) {
            this.windowService.openNewWindow(port.exposed.url, { external: true });
        }
    }

    protected updateStatusBar(): void {
        const exposedPublic: number[] = [];
        const exposedPrivate: number[] = [];

        for (const port of this.portsService.ports) {
            if (isExposedServedPort(port)) {
                (port.exposed.visibility === PortVisibility.PUBLIC ? exposedPublic : exposedPrivate).push(port.localPort);
            }
        }

        let text: string;
        let tooltip = 'Click to open "Open Ports View"';
        if (exposedPublic.length || exposedPrivate.length) {
            text = 'Ports:';
            tooltip += '\n\nPorts';
            if (exposedPublic.length) {
                text += ` $(circle) ${exposedPublic.join(", ")}`;
                tooltip += `\nPublic: ${exposedPublic.join(", ")}`;
            }
            if (exposedPrivate.length) {
                text += ` $(ban) ${exposedPrivate.join(", ")}`;
                tooltip += `\nPrivate: ${exposedPrivate.join(", ")}`;
            }
        } else {
            text = '$(ban) No open ports';
        }

        this.statusBar.setElement(GitpodPortViewContribution.PORTS_OPEN_PORTS, {
            text,
            alignment: StatusBarAlignment.RIGHT,
            priority: 8,
            command: PORT_COMMANDS.SHOW_VIEW.id,
            tooltip
        });
    }
}
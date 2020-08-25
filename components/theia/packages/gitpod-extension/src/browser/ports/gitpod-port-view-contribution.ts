/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { FrontendApplicationContribution, AbstractViewContribution, StatusBar, StatusBarAlignment, FrontendApplication, WidgetManager } from "@theia/core/lib/browser";
import { inject } from "inversify";
import { MessageService } from "@theia/core";
import { GitpodPortViewWidget, PORT_WIDGET_FACTORY_ID } from "./gitpod-port-view-widget";
import { GitpodPortsService, PortChangeEvent, PortChange } from "./gitpod-ports-service";
import { MiniBrowserOpenHandler } from "@theia/mini-browser/lib/browser/mini-browser-open-handler";
import { ServedPort } from "../../common/served-ports-service";
import { PortConfig } from "@gitpod/gitpod-protocol";
import { PROBLEM_KIND } from "@theia/markers/lib/common/problem-marker";

export namespace PORT_COMMANDS {
    export const SHOW_VIEW = {
        id: 'ports.show_view',
    };
}

export class GitpodPortViewContribution extends AbstractViewContribution<GitpodPortViewWidget> implements FrontendApplicationContribution {
    static PORTS_OPEN_PORTS = 'ports-open';

    @inject(MiniBrowserOpenHandler) protected miniBrowserOpenHandler: MiniBrowserOpenHandler;
    @inject(GitpodPortsService) protected readonly portsService: GitpodPortsService;
    @inject(StatusBar) protected readonly statusBar: StatusBar;
    @inject(MessageService) protected messageService: MessageService;
    @inject(WidgetManager) protected widgetManager: WidgetManager;

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

    onStart(): void {
        this.updateStatusBar();
        this.initializeNotifier();
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        const problemsWidget = await this.widgetManager.getWidget(PROBLEM_KIND);
        const ref = problemsWidget;
        await this.openView({
            mode: "tab-after",
            ref
        });
    }

    protected async initializeNotifier(): Promise<void> {
        this.portsService.onPortsChanged(e => this.onPortsChanged(e));

        // Check if some ports were already served before we could add a listener.
        const servedPorts = await this.portsService.servedPorts;
        if (servedPorts.length > 0) {
            const e: PortChangeEvent = {
                served: { ports: servedPorts, didOpen: servedPorts, didClose: [] }
            };
            this.onPortsChanged(e);
        }
    }

    protected onPortsChanged(e: PortChangeEvent): void {
        if (e.served) {
            this.onServedPortsChanged(e.served);
        }
        if (e.exposed) {
            this.onExposedPortsChanged(e.exposed);
        }
        this.updateStatusBar();
    }

    protected currentNotifications = new Set<number>();
    protected async onServedPortsChanged({ didOpen }: PortChange<ServedPort>): Promise<void> {
        for (const servedPort of didOpen) {
            const port = servedPort.portNumber;
            if (this.currentNotifications.has(port)) {
                continue;
            }
            const isInUnusualRange = this.isInUnusualRange(port);

            if (servedPort.served == 'locally') {
                if (isInUnusualRange) {
                    // Do not show notifications
                    continue;
                }

                this.currentNotifications.add(port);
                this.messageService.info(`A service is listening on localhost:${port}. Please bind it to 0.0.0.0 or expose it through 'gp forward-port ${port} ${port+1}'.`).then(async () => {
                    this.currentNotifications.delete(port);
                });
                continue;
            }

            // Config is either:
            //  - statically configured (in the .gitpod.yml)
            //  - runtime config for ports already opened during this session
            let { config, isPersisted } = await this.portsService.findPortConfig(port);
            if (!config) {
                const range = this.portsService.findPortRange(port);
                if (range) {
                    config = { port, onOpen: range.onOpen };
                    // We don't automatically expose entire port ranges when onOpen is 'ignore',
                    // because that's probably not what users expect.
                    // However, these ports can still be access via localhost:<port>, or be exposed
                    // manually via the 'Open Ports' view.
                    if (config.onOpen !== 'ignore') {
                        await this.portsService.openPort(config);
                    }
                }
            }
            if (config && isPersisted) {
                // These are ports with a config in .gitpod.yml (either all along, or locally in the workspace)
                if (config.onOpen === 'ignore') {
                } else if (config.onOpen === 'open-browser') {
                    const uri = this.portsService.getPortURL(port);
                    if (!uri) {
                        console.warn(`Port ${port} has no URL associated with it`);
                        return;
                    }

                    const openedWindow = window.open(uri, new URL(uri).hostname);
                    if (openedWindow === null) {
                        // window open was blocked
                        this.showOpenServiceNotification(servedPort);
                    } else {
                        openedWindow.opener = null; // set opener to null
                        this.messageService.info(`A browser tab has been opened for port ${config.port}.`, { timeout: 5 })
                    }
                } else if (config.onOpen === 'open-preview') {
                    const url = this.portsService.getPortURL(port);
                    if (!url) {
                        console.warn(`Port ${port} has no URL associated with it`);
                        return;
                    }

                    await new Promise(resolve => setTimeout(resolve, 2000)).then(() => this.miniBrowserOpenHandler.openPreview(url))
                } else if (config.onOpen === 'notify') {
                    this.showOpenServiceNotification(servedPort);
                } else {
                    // This is the case where the port is configured but 'onOpen' is left to the default value ('notify')
                    this.showOpenServiceNotification(servedPort);
                }
            } else if (servedPort.served == 'globally') {
                // The port is not configured yet. The service was opened during this session, either by:
                //  - an extension (with just called openPort(..., 'private'))
                //  - the user starting a service
                
                if (!config) {
                    // All ports are opened as 'private' by default
                    await this.portsService.openPort(servedPort, 'private');
                }

                // Only show "open" notifications for ports that:
                //  - are in a certain port range
                //  - have an active service running
                if (!this.isInUnusualRange(port) && this.isWellKnownPort(port)) {
                    const offerMakePublic = !config || config.visibility === "private";
                    this.showOpenServiceNotification(servedPort, offerMakePublic);
                }
            }
        }
    }

    protected isWellKnownPort(port: number): boolean {
        return port <= 10000;
    }

    protected isInUnusualRange(port: number): boolean {
        // anything above 32767 seems odd (e.g. used by language servers)
        return !(0 < port && port < 32767);
    }

    protected async onExposedPortsChanged({ didOpen }: PortChange<PortConfig>): Promise<void> {
        for (const exposedPort of didOpen) {
            const port = exposedPort.port;
            if (this.currentNotifications.has(port)) {
                continue;
            }

            const range = this.portsService.findPortRange(port);
            if (range) {
                // Ports from ranges are exposed automatically, or manually via the 'Open Ports' view.
                // Thus there is no need for an extra notification here.
                continue;
            }

            // Only show "open" notifications for ports that:
            //  - are in a certain port range
            //  - have an active service running
            //  - are publicly exposed - all private ports will have their notification produced by the port being served
            if (!this.isInUnusualRange(port) && this.isWellKnownPort(port) && exposedPort.visibility === 'public') {
                const servedPorts = await this.portsService.servedPorts;
                const servedPort = servedPorts.find(i => i.portNumber == port);

                if (servedPort) {
                    this.showOpenServiceNotification(servedPort);
                }  
            }
        }
    }

    protected showOpenServiceNotification(servedPort: ServedPort, offerMakePublic: boolean = false) {
        // TODO It would be nice to have the following options here:
        //  - "Always Ignore"
        // see https://github.com/TypeFox/gitpod/issues/3892
        const makePublic = "Make Public";
        const openAction = "Open Preview";
        const openExternalAction = "Open Browser";
        const actions = offerMakePublic ? [makePublic, openAction, openExternalAction] : [openAction, openExternalAction];

        const port = servedPort.portNumber;
        this.currentNotifications.add(port);
        this.messageService.info('A service is available on port ' + port, ...actions).then(async result => {
            this.currentNotifications.delete(port);

            const uri = this.portsService.getPortURL(port);
            if (!uri) {
                console.warn(`Port ${port} has no URL associated with it`);
                return;
            }
            
            if (result == makePublic) {
                await this.portsService.openPort(servedPort, 'public');
            } else if (result == openAction) {
                await this.miniBrowserOpenHandler.openPreview(uri);
            } else if (result == openExternalAction) {
                window.open(uri, '_blank', 'noopener');
            }
        });
    }

    protected async updateStatusBar() {
        const servedPorts = await this.portsService.servedPorts;
        const instancePorts = await this.portsService.instancePorts;
        const ports = servedPorts.map(port => {
            const ip = instancePorts.find(ip => ip.port == port.portNumber)
            return { port, exposed: !!ip, visibility: ip && ip.visibility }
        });
        const openPublicPorts = ports.filter(p => p.exposed)
            .filter(p => p.visibility === 'public')
            .map(p => p.port.portNumber);

        const openPrivatePorts = ports.filter(p => p.exposed)
            // Count 'visibility === undefined' as private because it's the default visibility for all ports, and we auto-open ports
            .filter(p => p.visibility === 'private' || p.visibility === undefined)
            .map(p => p.port.portNumber);

        let text: string;
        let tooltip = 'Click to open "Open Ports View"';
        if (ports.length > 0) {
            text = 'Ports:';
            tooltip += '\n\nPorts';
            if (openPublicPorts.length > 0) {
                text += ` $(circle) ${openPublicPorts.join(", ")}`;
                tooltip += `\nPublic: ${openPublicPorts.join(", ")}`;
            }
            if (openPrivatePorts.length > 0) {
                text += ` $(ban) ${openPrivatePorts.join(", ")}`;
                tooltip += `\nPrivate: ${openPrivatePorts.join(", ")}`;
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
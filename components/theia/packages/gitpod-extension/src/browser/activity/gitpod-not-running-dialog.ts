/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MessageService } from "@theia/core";
import { BaseWidget, Widget, Message, Key } from "@theia/core/lib/browser";
import { ConnectionStatusService } from "@theia/core/lib/browser/connection-status-service";
import { WorkspaceInstance, GitpodClient } from "@gitpod/gitpod-protocol";
import { GitpodService } from "@gitpod/gitpod-protocol";
import { makeLink } from "@gitpod/gitpod-protocol/lib/util/make-link";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { formatHours } from "@gitpod/gitpod-protocol/lib/util/date-time";
import { GitpodInfo } from "../../common/gitpod-info";

export class GitpodNotRunningOverlay extends BaseWidget {

    protected readonly cancelReview: HTMLButtonElement;

    protected outOfCreditShowing = false;
    protected stopped = false;
    protected readonly mainAction: (() => void);
    protected readonly startAction: (() => void);

    constructor(service: GitpodService, info: GitpodInfo, messageService: MessageService, connectionStatus: ConnectionStatusService) {
        super();
        this.addClass('dialogOverlay');

        const container = document.createElement("div");
        container.classList.add('dialogBlock');
        this.node.appendChild(container);

        const titleContentNode = document.createElement("div");
        titleContentNode.classList.add('dialogTitle');
        container.appendChild(titleContentNode);

        const titleNode = document.createElement("div");
        titleContentNode.appendChild(titleNode);

        const contentNode = document.createElement("div");
        contentNode.classList.add('dialogContent');
        container.appendChild(contentNode);

        const contentRow = document.createElement("div");
        contentRow.style.display = 'flex';
        contentRow.style.flexFlow = 'row wrap';
        contentRow.style.alignItems = 'center';
        contentNode.appendChild(contentRow);

        const statusText = document.createElement('div');
        statusText.style.marginRight = '4px';
        statusText.textContent = 'Status: ';
        contentRow.appendChild(statusText);

        const status = document.createElement('div');
        status.style.marginRight = '4px';
        status.style.fontWeight = '500';
        contentRow.appendChild(status);

        const spinnerContainer = document.createElement('div');
        contentRow.appendChild(spinnerContainer);

        const spinner = document.createElement('div');
        spinner.classList.add('fa','fa-circle-o-notch', 'fa-spin');
        spinnerContainer.appendChild(spinner);

        const message = document.createElement('div');
        message.style.width = '100%';
        message.style.marginTop = '4px';
        contentRow.appendChild(message);

        const controlPanel = document.createElement('div');
        controlPanel.classList.add('dialogControl');
        container.appendChild(controlPanel);

        this.startAction = () => {
            const startWsUrl = new GitpodHostUrl(info.host).with({
                pathname: '/start/',
                hash: '#' + info.workspaceId
            }).toString();
            window.location.href = startWsUrl;
        }

        const startButton = document.createElement("button");
        startButton.classList.add('theia-button');
        controlPanel.appendChild(startButton);
        startButton.classList.add('main');
        startButton.classList.add('disabled');
        startButton.textContent = 'Start';
        startButton.onclick = this.startAction;

        const dashboardButton = document.createElement("button");
        dashboardButton.classList.add('theia-button');
        controlPanel.appendChild(dashboardButton);
        dashboardButton.classList.add('main');
        dashboardButton.classList.add('disabled');
        dashboardButton.textContent = 'Workspaces';

        makeLink(dashboardButton, new GitpodHostUrl(info.host).asDashboard().toString(), 'Workspaces');

        this.mainAction = () => {
            this.getContextUrl(info, service).then((contextURL: string) => {
                window.open(contextURL, '_self');
            });
        }

        const contextUrlButton = document.createElement("button");
        contextUrlButton.classList.add('theia-button');
        controlPanel.appendChild(contextUrlButton);
        contextUrlButton.classList.add('main');
        contextUrlButton.classList.add('enabled');
        contextUrlButton.textContent = 'Open Repository Page';
        this.getContextUrl(info, service).then((contextURL: string) => {
            const host = new URL(contextURL).host;
            contextUrlButton.textContent = 'View on ' + host;
        });
        contextUrlButton.onclick = this.mainAction;

        try {
            const onInstanceUpdate = (instance: WorkspaceInstance) => {
                if (instance.workspaceId !== info.workspaceId) {
                    // not for us.
                    return;
                }
                if (instance.status.phase === 'stopped') {
                    this.stopped = true;
                }
                if (!this.outOfCreditShowing) {
                    titleNode.textContent = `Workspace Not Running`;
                    status.textContent = instance.status.phase;

                    if (instance.status.conditions.timeout) {
                        message.textContent = "Workspace has timed out.";
                    } else if (instance.status.conditions.failed) {
                        message.textContent = instance.status.conditions.failed;
                    } else if (instance.status.message) {
                        message.textContent = instance.status.message;
                    }
                    if (message.textContent) {
                        // capitalize message
                        message.textContent = message.textContent.charAt(0).toUpperCase() + message.textContent.slice(1);

                        if (!message.textContent.endsWith(".")) {
                            message.textContent += ".";
                        }
                    }

                    // If this workspace is currently starting, redirect to the "/start" page to provide a consistent experience.
                    // Note: we only want to redirect here if the workspace was stopped before. If it wasn't this status change is probably a fluke
                    //       and we don't want to forcefully move the user away from their work.
                    if (this.stopped && (instance.status.phase === 'preparing' || instance.status.phase === 'creating' || instance.status.phase === 'initializing')) {
                        this.startAction();
                    }

                    if (instance.status.phase !== 'running') {
                        if (instance.status.phase === 'stopped') {
                            spinner.style.visibility = 'hidden';
                            startButton.style.visibility = 'visible';
                        } else {
                            spinner.style.visibility = 'visible';
                            startButton.style.visibility = 'hidden';
                        }
                        this.open();
                    } else {
                        this.close();
                    }
                }
            };
            const noOp = () => {};
            const onCreditAlert = (creditAlert: any /* CreditAlert */) => {
                if (creditAlert.remainingUsageHours <= 0) {
                    spinner.style.visibility = 'hidden';
                    startButton.style.visibility = 'hidden';
                    titleNode.textContent = 'Gitpod Credit Alert';
                    status.textContent = 'You have run out of Gitpod Hours.';
                    contextUrlButton.onclick = () => {
                        const url = new GitpodHostUrl(info.host).asUpgradeSubscription().toString();
                        window.open(url, '_blank');
                    }
                    contextUrlButton.textContent = 'Upgrade Subscription';
                    this.outOfCreditShowing = true;
                    this.open();
                } else {
                    const action = 'Add Credits';
                    messageService.warn(`Remaining usage time: ${formatHours(creditAlert.remainingUsageHours)}h`, { timeout: -1 }, action).then( result => {
                        if (action === result) {
                            const url = new GitpodHostUrl(info.host).asUpgradeSubscription().toString();
                            window.open(url, '_blank');
                        }
                    });
                }
            }
            connectionStatus.onStatusChange(async () => {
                const wsInfo = await service.server.getWorkspace({workspaceId: info.workspaceId});
                if (wsInfo.latestInstance) {
                    onInstanceUpdate(wsInfo.latestInstance);
                }
            });
            const doc = window.document;
            doc.addEventListener('visibilitychange', async () => {
                if (doc.visibilityState === 'visible') {
                    const wsInfo = await service.server.getWorkspace({workspaceId: info.workspaceId});
                    if (wsInfo.latestInstance) {
                        onInstanceUpdate(wsInfo.latestInstance);
                    }
                }
            });
            const partialClient: Partial<GitpodClient> = {
                onInstanceUpdate,
                onWorkspaceImageBuildLogs: noOp,
                onHeadlessWorkspaceLogs: noOp,
                onCreditAlert   // IO concern
            } as Partial<GitpodClient>;
            service.registerClient(partialClient)
        } catch (err) {
            console.error(err);
        }

        this.update();
    }

    open() {
        if (!this.isAttached) {
            Widget.attach(this, document.body);
        }
        super.show()
        this.activate();
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.addKeyListener(document.body, Key.ENTER, () => this.mainAction && this.mainAction());
    }

    private async getContextUrl(info: GitpodInfo, service: GitpodService): Promise<string> {
        const workspace = await service.server.getWorkspace({workspaceId: info.workspaceId});
        return workspace.workspace.contextURL;
    }
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { injectable, inject } from "inversify";
import { AbstractDialog, DialogProps, ReactWidget } from "@theia/core/lib/browser";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { GitpodInfoService } from "../common/gitpod-info";
import { WorkspaceInstanceUser } from "@gitpod/gitpod-protocol";
import { GitpodLayoutRestorer } from "./gitpod-shell-layout-restorer";
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';

@injectable()
export class GitpodShareWidget extends ReactWidget {

    @inject(GitpodInfoService)
    protected infoProvider: GitpodInfoService;

    @inject(GitpodServiceProvider)
    protected serviceProvider: GitpodServiceProvider;

    protected isWorkspaceOwner?: boolean;
    protected workspaceUserPoll?: NodeJS.Timer;
    protected workspaceUsers?: WorkspaceInstanceUser[];

    protected async onAfterAttach() {
        const info = await this.infoProvider.getInfo();
        const service = await this.serviceProvider.getService();
        this.isWorkspaceOwner = await service.server.isWorkspaceOwner(info.workspaceId);
        this.update();

        this.startWorkspaceUserPolling(info.workspaceId);
    }

    protected async startWorkspaceUserPolling(workspaceId: string) {
        if (this.workspaceUserPoll) {
            this.stopWorkspaceUserPolling();
        }
        if (this.isWorkspaceOwner) {
            this.workspaceUserPoll = setInterval(async () => {
                const gitpodService = await this.serviceProvider.getService();
                const user = await gitpodService.server.getLoggedInUser();
                this.workspaceUsers = (await gitpodService.server.getWorkspaceUsers(workspaceId)).filter(u => u.userId != user.id);
                this.update();
            }, 10000);
        }
    }

    protected async stopWorkspaceUserPolling() {
        if (this.workspaceUserPoll) {
            clearInterval(this.workspaceUserPoll);
            this.workspaceUserPoll = undefined;
        }
    }

    protected render(): React.ReactChild {
        if (!this.isWorkspaceOwner) {
            return <div />;
        }
        return <div><div className='active-users'>
            {this.workspaceUsers && this.workspaceUsers.map((u, i) => this.newAvatar(u, i))}
        </div></div>;
    }

    protected newAvatar(user: WorkspaceInstanceUser, index: number): React.ReactChild {
        return <div key={index} className='avatar' title={user.name}>
            <img src={user.avatarUrl} />
        </div>
    }

}

export class GitpodShareDialogProps extends DialogProps {
}

export class GitpodShareDialog extends AbstractDialog<boolean> {
    readonly value: boolean = true;
    protected shareWorkspace?: boolean;
    protected currentStateMessage: HTMLElement;
    protected linkBox: HTMLElement;

    @inject(GitpodInfoService)
    protected infoProvider: GitpodInfoService;

    @inject(GitpodServiceProvider)
    protected serviceProvider: GitpodServiceProvider;

    @inject(GitpodLayoutRestorer)
    protected layoutRestorer: GitpodLayoutRestorer;

    constructor(@inject(GitpodShareDialogProps) protected readonly props: GitpodShareDialogProps) {
        super(props);

        this.appendAcceptButton();
        this.appendCloseButton("Done");
        this.appendContent();
    }

    public async open() {
        // always share this  workspace when this dialog is opened
        try {
            await this.setWorkspaceShareable(true);
            this.shareWorkspace = true;
            this.updateUI();
        } catch (e) {
            if ('code' in e && (e.code == ErrorCodes.EE_FEATURE || e.code == ErrorCodes.EE_LICENSE_REQUIRED)) {
                this.showNoLicenseContent();
            }
        }
        return super.open();
    }

    protected updateUI() {
        if (this.shareWorkspace) {
            if (this.acceptButton) {
                this.acceptButton.textContent = "Stop Sharing";
            }
            if (this.currentStateMessage) {
                this.currentStateMessage.innerHTML = 'Your workspace is currently <b>shared</b>. Anyone with the link can access this workspace.';
            }
            if (this.linkBox) {
                this.linkBox.style.opacity = "1";
            }
            this.titleNode.textContent = "Workspace Shared";
        } else {
            if (this.acceptButton) {
                this.acceptButton.textContent = "Share";
            }
            if (this.currentStateMessage) {
                this.currentStateMessage.innerHTML = 'Your workspace is currently <b>not shared</b>. Only you can access it.';
            }
            if (this.linkBox) {
                this.linkBox.style.opacity = "var(--theia-mod-disabled-opacity)";
            }
            this.titleNode.textContent = "Share Workspace";
        }
    }

    protected async accept() {
        const newState = !this.shareWorkspace;
        await this.setWorkspaceShareable(newState);
        this.shareWorkspace = newState;
        this.updateUI();
    }

    protected async setWorkspaceShareable(shareable: boolean): Promise<void> {
        const info = await this.infoProvider.getInfo();
        const gitpodService = this.serviceProvider.getService();
        await gitpodService.server.controlAdmission(info.workspaceId, shareable ? "everyone" : "owner");
        const layout = this.layoutRestorer.captureLayout();
        gitpodService.server.storeLayout(info.workspaceId, layout);
    }

    protected async isWorkspaceShared(): Promise<boolean> {
        const info = await this.infoProvider.getInfo();
        const gitpodService = this.serviceProvider.getService();
        const workspace = await gitpodService.server.getWorkspace(info.workspaceId);
        return workspace.workspace.shareable || false;
    }

    protected showNoLicenseContent() {
        // clean first
        this.contentNode.innerHTML = "";

        const licenseLink = new GitpodHostUrl(window.location.href).withoutWorkspacePrefix().with({ pathname: "license"}).toString();
        const eeFeatureMessage = document.createElement("div");
        eeFeatureMessage.setAttribute('style', 'max-width: 30vw; padding-bottom: 1em');
        eeFeatureMessage.innerHTML = `<p><strong>Workspace sharing is an enterprise feature and requires a license.</strong></p>
        <p>To enable Workspace Snapshots in your Gitpod installation, please <a href="${licenseLink}" target="_blank">purchase a license</a>.</p>`;
        this.contentNode.appendChild(eeFeatureMessage);

        if (this.acceptButton) {
            this.acceptButton.style.display = 'none';
        }
    }

    protected appendContent() {
        const messageNode = document.createElement("div");
        messageNode.setAttribute('style', 'max-width: 30vw; padding-bottom: 1em');
        messageNode.innerHTML = "<p><b>Warning:</b> Sharing your workspace with others also means sharing your access to your repository. Everyone with access to the workspace you share can commit in your name.</p>";
        this.contentNode.appendChild(messageNode);

        const enableSharingPanel = document.createElement("div");

        this.linkBox = document.createElement('div');
        this.linkBox.className = 'linkbox';
        enableSharingPanel.appendChild(this.linkBox);

        const link = document.createElement('span');
        link.innerText = window.location.href;
        link.onclick = () => this.selectElement(link);
        this.linkBox.appendChild(link);

        const copyToClipboard = document.createElement('i');
        copyToClipboard.className = 'fa fa-link';
        copyToClipboard.title = 'Copy link to clipboard';
        copyToClipboard.onclick = () => {
            this.selectElement(link);
            document.execCommand('copy');
        };
        copyToClipboard.style.marginLeft = "0.5em";
        this.linkBox.appendChild(copyToClipboard);

        this.currentStateMessage = document.createElement("p");
        enableSharingPanel.appendChild(this.currentStateMessage);

        this.contentNode.appendChild(enableSharingPanel);
    }

    protected selectElement(element: HTMLElement) {
        const range = document.createRange();
        range.selectNode(element);

        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

}
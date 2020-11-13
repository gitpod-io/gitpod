/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodInfoService } from '../common/gitpod-info';
import { inject, injectable } from 'inversify';
import { FrontendApplicationContribution, FrontendApplication, Widget, ContextMenuRenderer, CommonMenus, ConfirmDialog, StatusBar, StatusBarAlignment, CommonCommands } from '@theia/core/lib/browser';
import { WorkspaceCommands } from '@theia/workspace/lib/browser';
import { GitpodServiceProvider } from './gitpod-service-provider';
import { CommandContribution, MAIN_MENU_BAR, MenuContribution, CommandRegistry, MenuModelRegistry, Command, MessageService } from '@theia/core';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { makeLink } from '@gitpod/gitpod-protocol/lib/util/make-link';

import '../../styles/gitpod-style.css';
import { GitpodAccountInfoDialog } from './gitpod-account-info';
import { GitpodShareWidget, GitpodShareDialog } from './gitpod-share-widget';
import { User, Branding, WorkspaceInstance } from '@gitpod/gitpod-protocol';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { TAKE_SNAPSHOT_COMMAND } from './gitpod-snapshot-support';
import { GitpodBranding } from './gitpod-branding';
import { GitpodMainMenuFactory } from './gitpod-main-menu';
import { getWorkspaceID } from "./utils";

export namespace GitpodMenus {
    export const owner = ['gitpod', 'owner'];
    export const nonOwner = ['gitpod', 'non-owner'];
    export const workspace = [...MAIN_MENU_BAR, '8_workspace'];
    export const contactGroup = [...CommonMenus.HELP, 'contact'];
}

@injectable()
export class GitpodUiContribution implements FrontendApplicationContribution, CommandContribution, MenuContribution {

    @inject(GitpodInfoService)
    protected infoProvider: GitpodInfoService;

    @inject(GitpodServiceProvider)
    protected serviceProvider: GitpodServiceProvider;

    @inject(ContextMenuRenderer)
    protected menuRenderer: ContextMenuRenderer;

    @inject(GitpodAccountInfoDialog)
    protected acountInfoDialog: GitpodAccountInfoDialog;

    @inject(GitpodShareWidget)
    protected shareWidget: GitpodShareWidget;

    @inject(GitpodShareDialog)
    protected shareDialog: GitpodShareDialog;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(MessageService)
    protected messageService: MessageService;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(MenuModelRegistry)
    protected readonly menuRegistry: MenuModelRegistry;

    @inject(GitpodMainMenuFactory)
    protected readonly mainMenu: GitpodMainMenuFactory;

    @inject(GitpodBranding) protected readonly gitpodBranding: GitpodBranding;

    protected isWorkspaceOwner = new Deferred<boolean>();
    protected canChangeTimeout = new Deferred<boolean>();

    onStart(app: FrontendApplication): void {
        this.internalAsyncOnStart(app);
        this.gitpodBranding.branding
            .then(branding => this.applyBranding(branding))
            .catch(err => console.log(`failed to fetch branding: ${err}`));
    }

    private async internalAsyncOnStart(app: FrontendApplication): Promise<void> {
        const workspaceId = getWorkspaceID();
        try {
            const service = this.serviceProvider.getService();
            const user = await service.server.getLoggedInUser();
            service.server.isWorkspaceOwner(workspaceId).then((isOwner) => {
                this.isWorkspaceOwner.resolve(isOwner);
            });
            service.server.getWorkspaceTimeout(workspaceId).then(resp => {
                this.canChangeTimeout.resolve(resp.canChange);
            });

            service.listenToInstance(workspaceId).then(listener => {
                const update = () => {
                    if (listener.info.latestInstance) {
                        this.onInstanceUpdate(listener.info.latestInstance);
                    }
                }
                update();
                listener.onDidChange(() => update());
            });

            const branding = await this.gitpodBranding.branding;
            this.addLogoButton(app, branding);
            this.addRightMenu(app, user);
        } catch {
            const info = await this.infoProvider.getInfo();
            window.location.href = new GitpodHostUrl(info.host).withApi({
                pathname: '/login/',
                search: 'returnTo=' + encodeURIComponent(window.location.toString())
            }).toString();
        }
    }

    protected async applyBranding(branding: Branding) {
        const { ide } = branding;
        if (ide) {
            const linkNameToCommandId = (link: string) => `gitpod.help.${link.replace(/\W/g, '-')}`;
            ide.helpMenu.filter(link => !!link.name).forEach((link, index) => {
                const id = linkNameToCommandId(link.name);
                this.commandRegistry.registerCommand({
                    id
                }, {
                    execute: () => this.windowService.openNewWindow(link.url)
                });
                this.menuRegistry.registerMenuAction(GitpodMenus.contactGroup, {
                    commandId: id,
                    label: link.name,
                    order: String(index)
                });
            });
            this.mainMenu.update();
        } else {
            // Handle the default case (Gitpod)
            this.statusBar.setElement('support-chat-button', {
                text: `$(comments)`,
                alignment: StatusBarAlignment.RIGHT,
                priority: 7,
                tooltip: "Chat with us on Discourse",
                command: GitpodCommands.OPEN_COMMUNITY.id
            });

            // These extend the menu create in registerMenus below
            this.menuRegistry.registerMenuAction(GitpodMenus.contactGroup, {
                commandId: GitpodCommands.REPORT_ISSUE.id,
                label: 'Report Issue',
                order: '1'
            });
            this.menuRegistry.registerMenuAction(GitpodMenus.contactGroup, {
                commandId: GitpodCommands.FOLLOW_TWITTER.id,
                label: 'Follow us on Twitter',
                order: '2'
            });
            this.mainMenu.update();
        }
    }

    protected async addLogoButton(app: FrontendApplication, branding: Branding) {
        const widgets = app.shell.getWidgets("top");
        if (widgets[0]) {
            const logo = widgets[0];
            const info = await this.infoProvider.getInfo();
            const theiaLogo = branding.ide && branding.ide.logo;
            if (theiaLogo) {
                logo.node.style.background = `url(${theiaLogo}) 50% 50% / 40px 25px no-repeat`;
            }
            makeLink(
                logo.node,
                new GitpodHostUrl(info.host).asDashboard().toString(),
                'Open Workspaces');
        }
    }

    protected addRightMenu(app: FrontendApplication, user: User) {
        const growingDummy = new Widget();
        growingDummy.id = 'growing';
        growingDummy.node.style.flexGrow = '1';
        app.shell.addWidget(growingDummy, { area: 'top', rank: 898 });

        this.shareWidget.id = 'share-widget';
        app.shell.addWidget(this.shareWidget, { area: 'top', rank: 899 });
        this.shareWidget.update();
        this.shareWidget.activate();

        const cornerMenuElement = document.createElement('div');
        cornerMenuElement.className = 'gitpod-dropdown-main';
        cornerMenuElement.appendChild(this.createUserIcon(user));
        cornerMenuElement.onclick = () => this.openCornerMenu({ x: cornerMenuElement.offsetLeft, y: cornerMenuElement.offsetTop + cornerMenuElement.clientHeight });

        const cornerMenu = new Widget({ node: cornerMenuElement });
        cornerMenu.id = 'gitpod-corner-menu';
        app.shell.addWidget(cornerMenu, { area: 'top', rank: 900 });
    }
    protected createUserIcon(user: User) {
        const avatarUrl = user.avatarUrl
        if (avatarUrl) {
            const icon = document.createElement('img');
            icon.className = 'gitpod-dropdown-icon';
            icon.src = avatarUrl;
            return icon;
        } else {
            const abbr = (name: string) => name.split(/(\W)/g).filter(x => x.length > 1).map(x => x[0].toUpperCase()).join("").substr(0, 2);

            const span = document.createElement('span');
            span.innerText = abbr(user.name || "Unknown");
            span.style.textAlign = "center";
            span.style.width = "100%";

            const div = document.createElement('div');
            div.className = 'gitpod-dropdown-icon';
            div.appendChild(span);
            // line-height same as height of 'gitpod-dropdown-icon' class
            div.style.lineHeight = "calc(var(--theia-private-sidebar-tab-width)/2)";
            div.style.backgroundColor = "var(--theia-titleBar-activeForeground)";
            div.style.color = "var(--theia-titleBar-activeBackground)"
            div.style.fontWeight = "bold";
            return div;
        }
    }

    protected async openCornerMenu(position: { x: number, y: number }) {
        const isOwner = await this.isWorkspaceOwner.promise;
        if (isOwner) {
            this.menuRenderer.render(['gitpod', 'owner'], position);
        } else {
            this.menuRenderer.render(['gitpod', 'non-owner'], position)
        }
    }

    private async stopWorkspace() {
        const service = await this.serviceProvider.getService();
        const info = await this.infoProvider.getInfo();

        if (await service.server.isWorkspaceOwner(info.workspaceId)) {
            service.server.stopWorkspace(info.workspaceId);
        } else {
            this.showNoPermissionMessage();
        }
    }

    protected async onInstanceUpdate(instance: WorkspaceInstance) {
        const canChangeTimeout = await this.canChangeTimeout.promise;
        if (canChangeTimeout) {
            let color = "";
            if (instance.status.timeout == '180m') {
                color = "var(--theia-notificationsWarningIcon-foreground)";
            }

            this.statusBar.setElement('workspace-timeout-button', {
                text: `$(hourglass)`,
                alignment: StatusBarAlignment.RIGHT,
                priority: 6,
                tooltip: `Workspace Timeout: ${instance.status.timeout}. Click to extend.`,
                command: GitpodCommands.EXTEND_TIMEOUT.id,
                color
            });
        }
    }

    async registerCommands(commands: CommandRegistry): Promise<void> {
        const info = await this.infoProvider.getInfo();
        commands.registerCommand(GitpodCommands.STOP_WORKSPACE, {
            execute: async () => this.stopWorkspace()
        });
        commands.registerCommand(GitpodCommands.OPEN_DASHBOARD, {
            execute: async () => {
                this.windowService.openNewWindow(info.host);
            }
        });
        commands.registerCommand(GitpodCommands.OPEN_ACCESS_CONTROL, {
            execute: async () => {
                const url: string = new GitpodHostUrl(info.host).asAccessControl().toString();
                this.windowService.openNewWindow(url);
            }
        });
        commands.registerCommand(GitpodCommands.SHARE_WORKSPACE, {
            execute: async () => {
                this.shareDialog.open();
            }
        });
        commands.registerCommand(GitpodCommands.SHOW_ACCOUNT_INFO, {
            execute: async () => {
                this.acountInfoDialog.open();
            }
        });
        commands.registerCommand(GitpodCommands.OPEN_COMMUNITY, {
            execute: () => this.windowService.openNewWindow("https://community.gitpod.io/")
        });
        commands.registerCommand(GitpodCommands.OPEN_DOCUMENTATION, {
            execute: () => this.windowService.openNewWindow("https://www.gitpod.io/docs/")
        });
        commands.registerCommand(GitpodCommands.REPORT_ISSUE, {
            execute: () => this.windowService.openNewWindow("https://github.com/gitpod-io/gitpod/issues/new/choose")
        });
        commands.registerCommand(GitpodCommands.FOLLOW_TWITTER, {
            execute: () => this.windowService.openNewWindow("https://twitter.com/gitpod")
        });
        commands.registerCommand(GitpodCommands.UPGRADE_SUBSCRIPTION, {
            execute: async () => {
                const url: string = new GitpodHostUrl(info.host).asUpgradeSubscription().toString();
                this.windowService.openNewWindow(url);
            }
        });
        commands.registerCommand(GitpodCommands.EXTEND_TIMEOUT, {
            execute: async () => {
                await this.extendTimeout();
            }
        })
    }

    protected async extendTimeout() {
        // TODO: ask for upgrade if the current subscription does not allow this feature
        const service = await this.serviceProvider.getService();
        const info = await this.infoProvider.getInfo();

        if (await service.server.isWorkspaceOwner(info.workspaceId)) {
            try {
                const result = await service.server.setWorkspaceTimeout(info.workspaceId, "180m");
                if (!!result.resetTimeoutOnWorkspaces && result.resetTimeoutOnWorkspaces.length > 0) {
                    this.messageService.warn(`Workspace timeout has been extended to three hours. This reset the workspace timeout for other workspaces.`);
                } else {
                    this.messageService.info(`Workspace timeout has been extended to three hours.`);
                }
            } catch (err) {
                this.messageService.error(`Cannot extend workspace timeout: ${err.toString()}`);
            }
        } else {
            this.showNoPermissionMessage();
        }
    }

    protected showNoPermissionMessage() {
        new ConfirmDialog({
            title: 'Share Workspace',
            msg: 'This workspace has been shared with you - you cannot change its settings'
        }).open();
    }

    async registerMenus(menus: MenuModelRegistry): Promise<void> {
        menus.registerMenuAction(GitpodMenus.owner, {
            commandId: GitpodCommands.SHOW_ACCOUNT_INFO.id,
            label: 'Account',
            order: '0'
        });
        menus.registerMenuAction(GitpodMenus.owner, {
            commandId: TAKE_SNAPSHOT_COMMAND.id,
            label: 'Share Workspace Snapshot',
            order: '1'
        });
        menus.registerMenuAction(GitpodMenus.owner, {
            commandId: GitpodCommands.SHARE_WORKSPACE.id,
            label: 'Share Running Workspace',
            order: '11'
        });
        menus.registerMenuAction(GitpodMenus.owner, {
            commandId: GitpodCommands.OPEN_DASHBOARD.id,
            label: 'Open Workspaces',
            order: '2'
        });
        menus.registerMenuAction(GitpodMenus.owner, {
            commandId: GitpodCommands.OPEN_ACCESS_CONTROL.id,
            label: 'Open Access Control',
            order: '21'
        });
        menus.registerMenuAction(GitpodMenus.owner, {
            commandId: GitpodCommands.STOP_WORKSPACE.id,
            label: 'Stop Workspace',
            order: '3'
        });

        menus.registerMenuAction(GitpodMenus.nonOwner, {
            commandId: GitpodCommands.SHOW_ACCOUNT_INFO.id,
            label: 'Account',
            order: '0'
        });
        menus.registerMenuAction(GitpodMenus.nonOwner, {
            commandId: GitpodCommands.OPEN_DASHBOARD.id,
            label: 'Open Workspaces',
            order: '1'
        });

        // Replace `Close Workspace` with `Stop Workspace`
        menus.unregisterMenuAction(WorkspaceCommands.CLOSE.id, CommonMenus.FILE_CLOSE)
        menus.registerMenuAction(CommonMenus.FILE_CLOSE, {
            commandId: GitpodCommands.STOP_WORKSPACE.id,
            label: 'Stop Workspace',
        });

        // Create `Workspace` top bar submenu
        menus.registerSubmenu(GitpodMenus.workspace, 'Workspace');
        menus.registerMenuAction(GitpodMenus.workspace, {
            commandId: TAKE_SNAPSHOT_COMMAND.id,
            label: 'Share Workspace Snapshot',
            order: '1'
        });
        menus.registerMenuAction(GitpodMenus.workspace, {
            commandId: GitpodCommands.SHARE_WORKSPACE.id,
            label: 'Share Running Workspace',
            order: '2'
        });
        // TODO: Pin workspace
        // TODO: Rename workspace
        menus.registerMenuAction(GitpodMenus.workspace, {
            commandId: GitpodCommands.STOP_WORKSPACE.id,
            label: 'Stop Workspace',
            order: '9'
        });

        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: GitpodCommands.OPEN_DOCUMENTATION.id,
            label: 'Gitpod Documentation'
        });
        menus.registerMenuAction(GitpodMenus.contactGroup, {
            commandId: GitpodCommands.OPEN_COMMUNITY.id,
            label: 'Gitpod Community',
            order: '0'
        });

        // rename `About` to `About Gitpod`
        menus.unregisterMenuAction(CommonCommands.ABOUT_COMMAND.id, CommonMenus.HELP)
        menus.registerMenuAction(CommonMenus.HELP, {
            commandId: CommonCommands.ABOUT_COMMAND.id,
            label: 'About Gitpod',
            order: '9'
        });
    }

}

export namespace GitpodCommands {
    export const STOP_WORKSPACE: Command = {
        id: 'gitpod.stop.ws',
        label: 'Gitpod: Stop Workspace'
    }
    export const OPEN_DASHBOARD: Command = {
        id: 'gitpod.open.dashboard',
        label: 'Gitpod: Open Workspaces List'
    }
    export const OPEN_ACCESS_CONTROL: Command = {
        id: 'gitpod.open.accessControl',
        label: 'Gitpod: Open Access Control'
    }
    export const SHARE_WORKSPACE: Command = {
        id: 'gitpod.share.workspace',
        label: 'Gitpod: Share Running Workspace'
    }
    export const SHOW_ACCOUNT_INFO: Command = {
        id: 'gitpod.show.acount.info',
        label: 'Gitpod: Account'
    }
    export const OPEN_DOCUMENTATION: Command = {
        id: 'gitpod.open.documentation',
        label: 'Gitpod: Documentation'
    }
    export const OPEN_COMMUNITY: Command = {
        id: 'gitpod.open.community',
        label: 'Gitpod: Open Discourse Community (Discuss and get support)'
    }
    export const FOLLOW_TWITTER: Command = {
        id: 'gitpod.help.follow',
        label: 'Gitpod: Follow us on Twitter'
    }
    export const REPORT_ISSUE: Command = {
        id: 'gitpod.reportIssue',
        label: 'Gitpod: Report Issue'
    }
    export const UPGRADE_SUBSCRIPTION: Command = {
        id: 'gitpod.upgradeSubscription',
        label: 'Gitpod: Upgrade Subscription'
    }
    export const EXTEND_TIMEOUT: Command = {
        id: 'gitpod.ExtendTimeout',
        label: 'Gitpod: Extend Workspace Timeout'
    }
}
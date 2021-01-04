/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import { injectable, inject } from "inversify";

import { FrontendApplicationContribution, FrontendApplication, CommonMenus } from "@theia/core/lib/browser";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { UserMessage } from "@gitpod/gitpod-protocol";
import { UserMessageDialog } from "./user-message-dialog";
import { CommandContribution, MenuContribution, CommandRegistry, MenuModelRegistry, Command } from "@theia/core";
import { PreviewHandlerProvider } from "@theia/preview/lib/browser";
import { GitpodInfoService } from "../../common/gitpod-info";
import { GitpodBranding } from "../gitpod-branding";
import { Deferred } from "@theia/core/lib/common/promise-util";


@injectable()
export class UserMessageContribution implements FrontendApplicationContribution, CommandContribution, MenuContribution {

    @inject(GitpodServiceProvider) protected readonly serviceProvider: GitpodServiceProvider;
    @inject(GitpodInfoService) protected readonly serviceInfo: GitpodInfoService;
    @inject(PreviewHandlerProvider) protected readonly previewHandlerProvider: PreviewHandlerProvider;
    @inject(GitpodBranding) protected readonly gitpodBranding: GitpodBranding;

    protected readonly showReleaseNotesPromise = new Deferred<boolean>();
    protected get showReleaseNotes(): Promise<boolean> {
        return this.showReleaseNotesPromise.promise;
    }

    async onStart(app: FrontendApplication) {
        this.gitpodBranding.branding
            .then(branding => this.showReleaseNotesPromise.resolve(branding.ide && branding.ide.showReleaseNotes))
            .catch(err => this.showReleaseNotesPromise.reject(err));
        try {
            await this.showUserMessage();
        } catch (error) {
            console.log(error);
        }
    }

    async showUserMessage(unviewedOnly: boolean = true) {
        const showReleaseNotes = await this.showReleaseNotes;
        if (!showReleaseNotes) {
            return;
        }
        const service = await this.serviceProvider.getService();
        const info = await this.serviceInfo.getInfo();
        const messages = await service.server.getUserMessages({ releaseNotes: unviewedOnly, workspaceInstanceId: info.instanceId });
        if (messages.length < 1) {
            return;
        }

        this.doShow(messages);
    }

    protected async updateMessage(messages: UserMessage[]) {
        const service = await this.serviceProvider.getService();
        const messageIds = messages.map(m => m.id);
        await service.server.updateUserMessages({ messageIds });
    }

    protected async doShow(messages: UserMessage[]): Promise<void> {
        const dialog = new UserMessageDialog(messages, this.previewHandlerProvider);
        await dialog.open();
        this.updateMessage(messages);
    }

    openMessages: Command = {
        id: 'gitpod.message.open',
        label: 'Gitpod: Release Notes'
    }

    registerCommands(reg: CommandRegistry) {
        this.showReleaseNotes.then(show => {
            if (!show) {
                return;
            }
            reg.registerCommand(this.openMessages);
            const execute = () => this.showUserMessage(false);
            reg.registerHandler(this.openMessages.id, {
                execute
            })
        })
    }

    registerMenus(menus: MenuModelRegistry) {
        this.showReleaseNotes.then(show => {
            if (!show) {
                return;
            }
            menus.registerMenuAction(CommonMenus.HELP, {
                commandId: this.openMessages.id,
                label: 'Release Notes'
            });
        });
    }
}

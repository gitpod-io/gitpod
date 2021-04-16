/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Command, CommandContribution, CommandRegistry, MessageService } from "@theia/core";
import { FrontendApplicationContribution, open, OpenerService } from "@theia/core/lib/browser";
import { StatusBar, StatusBarAlignment } from "@theia/core/lib/browser/status-bar/status-bar";
import URI from "@theia/core/lib/common/uri";
import { inject, injectable, multiInject } from "inversify";
import { ForkMenu } from "../githoster/fork/fork-menu";
import { GitState } from "./git-state";
import { GitHosterExtension } from "./githoster-extension";
import { GitHosterModel } from "./model/githoster-model";

export namespace GitHosterCommand {
    export const fork: Command = {
        id: 'githoster.fork',
        label: 'Git: Fork...'
    }
    export const openContext: Command = {
        id: 'githoster.openContext',
        label: 'Go to Git repository'
    }
}

@injectable()
export class GitHosterFrontendContribution implements CommandContribution, FrontendApplicationContribution {

    @inject(ForkMenu)
    protected readonly forkMenu: ForkMenu;

    @multiInject(GitHosterExtension)
    protected readonly extensions: GitHosterExtension[];

    @inject(GitHosterModel.FACTORY_TYPE)
    protected readonly gitHosterModel: (hoster: string) => GitHosterModel;

    @inject(GitState.FACTORY_TYPE)
    protected readonly gitState: (hoster: string) => GitState;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    @inject(OpenerService)
    protected readonly openerService: OpenerService;

    protected currentContext: { label: string, url: string } | undefined;

    registerCommands(commands: CommandRegistry): void {

        const isEnabled = () => {
            // check if there is at least one enabled extension
            const firstEnabledExtension = this.extensions.find(ext => ext.enabled);
            return !!firstEnabledExtension;
        };
        const isVisible = isEnabled;

        commands.registerCommand(GitHosterCommand.fork, {
            execute: async () => {
                const extension = this.extensions.find(ext => ext.enabled);
                if (!extension) {
                    console.error("There is no GitHoster extension enabled.");
                    this.messageService.error("Unexpected error: There is no GitHoster extension enabled.");
                    return;
                }
                return this.forkMenu.show(extension.name).catch(err => {
                    this.messageService.error(err.toString());
                });
            },
            isEnabled, isVisible
        });

        commands.registerCommand(GitHosterCommand.openContext, {
            execute: () => this.currentContext && open(this.openerService, new URI(this.currentContext.url)),
            isEnabled: () => isEnabled() && !!this.currentContext,
            isVisible: () => isEnabled() && !!this.currentContext
        });
    }

    async onStart(): Promise<void> {
        this.renderStatus(this.extensions.find(ext => ext.enabled));

        this.extensions.forEach(ext => {
            this.gitHosterModel(ext.name).onDidChange(() => {
                this.renderStatus(ext);
            });

            ext.onStateChanged(_ => {
                this.renderStatus(ext);
            })

            this.gitState(ext.name).onChanged(() => {
                this.renderStatus(ext);
            })
        });
    }

    protected async renderStatus(extension?: GitHosterExtension): Promise<void> {
        if (extension && extension.enabled) {
            console.log("Render status for hoster %s (enabled %s)", extension.name, extension.enabled);
            this.currentContext = await this.gitState(extension.name).getCurrentContext();
            if (this.currentContext) {
                this.statusBar.setElement(`gitpod-context-${extension.name}`, {
                    text: `$(${extension.name.toLowerCase()}) ${this.currentContext.label}`,
                    alignment: StatusBarAlignment.LEFT,
                    priority: 1000,
                    command: GitHosterCommand.openContext.id,
                });
            } else {
                this.statusBar.removeElement(`gitpod-context-${extension.name}`);
            }
        } else if (extension) {
            this.statusBar.removeElement(`gitpod-context-${extension.name}`);
        }
    }
}

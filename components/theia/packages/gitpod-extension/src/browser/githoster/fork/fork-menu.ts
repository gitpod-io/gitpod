/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MessageService } from "@theia/core";
import { QuickOpenItem, QuickOpenMode, QuickOpenOptions, QuickOpenService } from "@theia/core/lib/browser";
import { WindowService } from "@theia/core/lib/browser/window/window-service";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { inject, injectable } from "inversify";
import { GitpodInfoService } from "../../../common/gitpod-info";
import { GitState } from "../git-state";
import { ForkCreator } from "./fork-creator";
import { ForksLoader } from "./forks-loader";

@injectable()
export class ForkMenu {

    @inject(QuickOpenService) protected readonly quickOpenService: QuickOpenService;
    @inject(ForksLoader.FACTORY_TYPE) protected readonly forksLoader: (hoster: string) => ForksLoader;
    @inject(ForkCreator.FACTORY_TYPE) protected readonly forkCreator: (hoster: string) => ForkCreator;

    @inject(GitState.FACTORY_TYPE) protected readonly gitState: (hoster: string) => GitState;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(WindowService) protected readonly windowService: WindowService;

    @inject(GitpodInfoService) protected infoProvider: GitpodInfoService;

    /**
     * Switch or Create Fork Menu:
     * ------------------------------------------------------------------------------
     * > Choose to create a new fork of ${repoName}, or select one to switch to.
     *      (or)
     * > Select a fork to switch to.
     * ------------------------------------------------------------------------------
     *      Fork to my account
     *      Switch to my fork of ${repoName}
     *      Fork to ${org} organization
     *      Switch to the fork at ${org} organization
     * ------------------------------------------------------------------------------
     */
    async show(hoster: string): Promise<void> {
        const currentOriginUrl = await this.gitState(hoster).getRemoteUrl("origin");
        if (!currentOriginUrl) {
            throw new Error("Couldn't read `origin` remote url.");
        }
        const parsedRemoteUrl = this.gitState(hoster).parseRemoteUrl(currentOriginUrl);
        if (!parsedRemoteUrl) {
            throw new Error("Couldn't parse owner/repo from `origin` remote url: " + currentOriginUrl);
        }

        const originRepo: ForksLoader.Repo = { ...parsedRemoteUrl };
        const repoFullName = `${originRepo.owner}/${originRepo.name}`;

        const items: QuickOpenItem[] = [];

        const done = new Deferred<void>();

        const { myLogin, createForkForOwners, switchToForkOfOwners, missingPermissions } = await this.forksLoader(hoster).computeForkMenuOptions(originRepo);

        createForkForOwners.forEach(newOwner => {
            items.push(this.createQuickOpenItem(
                `Fork to ${newOwner}/${originRepo.name}`,
                `The "${repoFullName}" repository will be forked to ${newOwner}/${originRepo.name}.`,
                `Successfully forked to "${newOwner}/${originRepo.name}" and adjusted the remote url.`,
                async () => {
                    try {
                        const fullName = await this.forkCreator(hoster).createFork(originRepo, newOwner === myLogin ? undefined : newOwner);
                        if (fullName) {
                            await this.gitState(hoster).useFork(fullName);
                        }
                        done.resolve();
                    } catch (err) {
                        done.reject(err);
                    }
                })
            );
        });

        switchToForkOfOwners.forEach(newOwner => {
            items.push(this.createQuickOpenItem(
                `Switch to existing fork ${newOwner}/${originRepo.name}`,
                `The remote url of git will be changed to "${newOwner}/${originRepo.name}".`,
                `Successfully changed the remote url of git to "${newOwner}/${originRepo.name}".`,
                async () => {
                    try {
                        await this.gitState(hoster).useFork(`${newOwner}/${originRepo.name}`);
                        done.resolve();
                    } catch (err) {
                        done.reject(err);
                    }
                }
            ));
        });

        missingPermissions.forEach(x => {
            items.push(this.createQuickOpenItem(x.menuLabel, x.menuDescription, x.menuCompleteMessage,
                async () => {
                    this.requestPermissionUpdate([x.scope], new URL(currentOriginUrl).hostname);
                    done.resolve();
                }
            ));
        });

        if (items.length < 1) {
            const message = `No options available to switch to a fork of this repository. 🦄`;
            this.messageService.info(message, { timeout: 10000 });
            return;
        }

        const options = QuickOpenOptions.resolve({
            placeholder: "Choose to create an own fork, or select a different fork from below:",
            fuzzyMatchLabel: true,
            fuzzySort: false,
            onClose: async () => {
                const timer = setTimeout(() => {
                    done.resolve();
                }, 2000);
                done.promise.then(() => clearTimeout(timer));
            }
        })
        this.quickOpenService.open({
            onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): void {
                acceptor(items);
            }
        }, options);
        return done.promise;
    }

    protected createQuickOpenItem(label: string, description: string, completeMessage: string, run: () => Promise<void>): QuickOpenItem {
        return new QuickOpenItem({
            label,
            description,
            run: mode => {
                if (mode !== QuickOpenMode.OPEN) {
                    return false;
                }
                run()
                    .then(() => this.messageService.info(completeMessage, { timeout: 10000 }))
                // .catch(e => this.messageService.error(e.message, { timeout: 0 }));
                return true;
            }
        });
    }

    protected async requestPermissionUpdate(requiredScopes: string[], host: string) {
        const info = await this.infoProvider.getInfo();
        const hostUrl = new GitpodHostUrl(info.host);
        const accessControlUrl = hostUrl.asAccessControl();
        const scopes = Array.from(requiredScopes).join(',');
        const returnToAccessControlUrl = accessControlUrl.with({ search: `updated=${host}@${scopes}` }).toString();
        const search = `returnTo=${encodeURIComponent(returnToAccessControlUrl)}&host=${host}&scopes=${scopes}`;
        const url = hostUrl.withApi({
            pathname: '/authorize',
            search
        }).toString();
        this.windowService.openNewWindow(url);
    }

}

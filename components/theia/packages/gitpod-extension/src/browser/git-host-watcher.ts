/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, multiInject } from "inversify";
import { Git, Repository } from "@theia/git/lib/common";
import { GitRepositoryTracker } from "@theia/git/lib/browser/git-repository-tracker";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { FrontendApplicationContribution } from "@theia/core/lib/browser";
import { GitHosterExtension } from "./githoster/githoster-extension";

@injectable()
export class GitHostWatcher implements FrontendApplicationContribution {

    @inject(Git)
    protected readonly git: Git;

    @inject(GitRepositoryTracker)
    protected readonly gitRepository: GitRepositoryTracker;

    @inject(GitpodServiceProvider)
    protected serviceProvider: GitpodServiceProvider;

    @multiInject(GitHosterExtension)
    protected gitHosterExtensions: GitHosterExtension[];

    async onStart() {
        this.update();
        this.gitRepository.onDidChangeRepository(() => this.update());
    }

    protected gitHost: string | undefined;
    protected async update() {
        const selectedRepo = this.gitRepository.selectedRepository;
        const gitHost = selectedRepo && await this.getGitHost(selectedRepo);
        if (this.gitHost === gitHost) {
            return;
        }
        this.gitHost = gitHost;
        const authProvider = gitHost && await this.getAuthProviderByHost(gitHost);
        const type = authProvider && authProvider.authProviderType;
        this.updateExtensions(type, gitHost);
    }

    protected updateExtensions(type: string | undefined, gitHost: string = "") {
        this.gitHosterExtensions.forEach(ext => ext.update(type === ext.name, gitHost));
    }

    protected async getAuthProviderByHost(host: string) {
        const authProviders = await this.getAuthProviders() || [];
        return authProviders.find(a => a.host === host);
    }

    protected authProviders: AuthProviderInfo[] | undefined;
    protected async getAuthProviders() {
        if (this.authProviders) {
            return this.authProviders;
        }
        const service = await this.serviceProvider.getService();
        this.authProviders = await service.server.getAuthProviders({});
        return this.authProviders;
    }

    protected async getGitHost(repository: Repository): Promise<string | undefined> {
        const remoteUrl = await this.getRemoteUrl(repository);
        if (!remoteUrl) {
            return undefined;
        }
        const gitHost = new URL(remoteUrl).hostname;
        return gitHost;
    }

    async getRemoteUrl(repository: Repository): Promise<string | undefined> {
        try {
            const remoteUrlResult = await this.git.exec(repository, ["remote", "get-url", "origin"]);
            return remoteUrlResult.stdout.trim();
        } catch (e) {
            return undefined;
        }
    }

}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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

    protected remoteUrl: string | undefined;
    protected async update() {
        const selectedRepo = this.gitRepository.selectedRepository;
        let remoteUrl = selectedRepo && await this.getRemoteUrl(selectedRepo);

        // updates should be performed on changes only
        {
            if (this.remoteUrl === remoteUrl?.toString()) {
                return;
            }
            this.remoteUrl = remoteUrl?.toString();
        }

        let gitHost = remoteUrl && remoteUrl.hostname;
        let authProvider = gitHost && await this.getAuthProviderByHost(gitHost);
        if (!authProvider && gitHost && remoteUrl) {
            // in case we cannot find the provider by hostname, let's try with simple path

            const pathSegments = remoteUrl.pathname.split("/");
            const gitHostWithPath = `${remoteUrl.pathname}/${pathSegments[0] || pathSegments[1]}`;
            authProvider = await this.getAuthProviderByHost(gitHostWithPath);
            if (authProvider) {
                gitHost = gitHostWithPath;
            }
        }

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
        this.authProviders = await service.server.getAuthProviders();
        return this.authProviders;
    }

    async getRemoteUrl(repository: Repository): Promise<URL | undefined> {
        try {
            const remoteUrlResult = await this.git.exec(repository, ["remote", "get-url", "origin"]);
            const result = remoteUrlResult.stdout.trim();
            return new URL(result);
        } catch (e) {
            return undefined;
        }
    }

}

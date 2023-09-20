/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project, User } from "@gitpod/gitpod-protocol";
import { RepoURL } from "../repohost";
import { inject, injectable } from "inversify";
import { HostContextProvider } from "../auth/host-context-provider";
import { Config } from "../config";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class ScmService {
    constructor(
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(Config) private readonly config: Config,
    ) {}

    async canInstallWebhook(currentUser: User, cloneURL: string) {
        try {
            const parsedUrl = RepoURL.parseRepoUrl(cloneURL);
            const hostContext = parsedUrl?.host ? this.hostContextProvider.get(parsedUrl?.host) : undefined;
            const authProvider = hostContext && hostContext.authProvider.info;
            const type = authProvider && authProvider.authProviderType;
            const host = authProvider?.host;
            if (!type || !host) {
                throw Error("Unknown host: " + parsedUrl?.host);
            }
            if (
                type === "GitLab" ||
                type === "Bitbucket" ||
                type === "BitbucketServer" ||
                (type === "GitHub" && (host !== "github.com" || !this.config.githubApp?.enabled))
            ) {
                const repositoryService = hostContext?.services?.repositoryService;
                if (repositoryService) {
                    return await repositoryService.canInstallAutomatedPrebuilds(currentUser, cloneURL);
                }
            }
            // The GitHub App case isn't handled here due to a circular dependency problem.
        } catch (error) {
            log.error("Failed to check precondition for creating a project.");
        }
        return false;
    }

    /*
     * Installs a prebuilds webhook if possible
     */
    async installWebhookForPrebuilds(project: Project, installer: User): Promise<string | undefined> {
        const { teamId, cloneUrl } = project;
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        const hostContext = parsedUrl?.host ? this.hostContextProvider.get(parsedUrl?.host) : undefined;
        const repositoryService = hostContext?.services?.repositoryService;
        if (repositoryService && (await repositoryService.canInstallAutomatedPrebuilds(installer, project.cloneUrl))) {
            log.info({ organizationId: teamId, userId: installer.id }, "Update prebuild installation for project.", {
                projectId: project.id,
            });
            return await repositoryService.installAutomatedPrebuilds(installer, cloneUrl);
        }
        return undefined;
    }

    /*
     * Uninstalls a prebuilds webhook if possible
     */
    async uninstallWebhookForPrebuilds(installer: User, cloneUrl: string, webhookId: string): Promise<void> {
        const parsedUrl = RepoURL.parseRepoUrl(cloneUrl);
        const hostContext = parsedUrl?.host ? this.hostContextProvider.get(parsedUrl?.host) : undefined;
        const repositoryService = hostContext?.services?.repositoryService;
        if (repositoryService && (await repositoryService.canInstallAutomatedPrebuilds(installer, cloneUrl))) {
            await repositoryService.uninstallAutomatedPrebuilds(installer, cloneUrl, webhookId);
        }
    }
}

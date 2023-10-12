/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project, User } from "@gitpod/gitpod-protocol";
import { RepoURL } from "../repohost";
import { inject, injectable } from "inversify";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class ScmService {
    constructor(@inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider) {}

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
            const repositoryService = hostContext?.services?.repositoryService;
            if (repositoryService) {
                return await repositoryService.canInstallAutomatedPrebuilds(currentUser, cloneURL);
            }
        } catch (error) {
            log.error("Failed to check precondition for creating a project.");
        }
        return false;
    }

    async installWebhookForPrebuilds(project: Project, installer: User) {
        // Install the prebuilds webhook if possible
        const { teamId, cloneUrl } = project;
        const parsedUrl = RepoURL.parseRepoUrl(project.cloneUrl);
        const hostContext = parsedUrl?.host ? this.hostContextProvider.get(parsedUrl?.host) : undefined;
        const repositoryService = hostContext?.services?.repositoryService;
        if (repositoryService) {
            log.info({ organizationId: teamId, userId: installer.id }, "Update prebuild installation for project.");
            await repositoryService.installAutomatedPrebuilds(installer, cloneUrl);
        }
    }
}

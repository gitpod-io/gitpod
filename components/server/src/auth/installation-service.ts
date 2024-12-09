/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AdminGetListRequest,
    AdminGetListResult,
    Configuration,
    EmailDomainFilterEntry,
    GitpodServer,
} from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { EmailDomainFilterDB, TeamDB } from "@gitpod/gitpod-db/lib";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import { Authorizer } from "../authorization/authorizer";
import { BlockedRepositoryDB } from "@gitpod/gitpod-db/lib/blocked-repository-db";
import { Config } from "../config";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

@injectable()
export class InstallationService {
    @inject(Config) private readonly config: Config;
    @inject(Authorizer) private readonly auth: Authorizer;
    @inject(BlockedRepositoryDB) private readonly blockedRepositoryDB: BlockedRepositoryDB;
    @inject(EmailDomainFilterDB) private readonly emailDomainFilterDB: EmailDomainFilterDB;
    @inject(TeamDB) private readonly teamDB: TeamDB;
    @inject(WorkspaceManagerClientProvider) private readonly clientProvider: WorkspaceManagerClientProvider;

    public async adminGetBlockedRepositories(
        userId: string,
        opts: AdminGetListRequest<BlockedRepository>,
    ): Promise<AdminGetListResult<BlockedRepository>> {
        await this.auth.checkPermissionOnInstallation(userId, "configure");
        const results = await this.blockedRepositoryDB.findAllBlockedRepositories(
            opts.offset,
            opts.limit,
            opts.orderBy,
            opts.orderDir === "asc" ? "ASC" : "DESC",
            opts.searchTerm,
        );
        return results;
    }

    public async adminCreateBlockedRepository(
        userId: string,
        opts: Pick<BlockedRepository, "urlRegexp" | "blockUser" | "blockFreeUsage">,
    ): Promise<BlockedRepository> {
        await this.auth.checkPermissionOnInstallation(userId, "configure");
        return this.blockedRepositoryDB.createBlockedRepository(opts.urlRegexp, opts.blockUser, opts.blockFreeUsage);
    }

    public async adminDeleteBlockedRepository(userId: string, blockedRepositoryId: number): Promise<void> {
        await this.auth.checkPermissionOnInstallation(userId, "configure");
        return this.blockedRepositoryDB.deleteBlockedRepository(blockedRepositoryId);
    }

    public async adminGetBlockedEmailDomains(userId: string): Promise<EmailDomainFilterEntry[]> {
        await this.auth.checkPermissionOnInstallation(userId, "configure");
        return this.emailDomainFilterDB.getFilterEntries();
    }

    public async adminCreateBlockedEmailDomain(
        userId: string,
        opts: EmailDomainFilterEntry,
    ): Promise<EmailDomainFilterEntry> {
        await this.auth.checkPermissionOnInstallation(userId, "configure");
        return this.emailDomainFilterDB.storeFilterEntry(opts);
    }

    public async getWorkspaceDefaultImage(): Promise<string> {
        return this.config.workspaceDefaults.workspaceImage;
    }

    async getOnboardingState(): Promise<GitpodServer.OnboardingState> {
        // Find useful details about the state of the Gitpod installation.
        const { rows } = await this.teamDB.findTeams(
            0 /* offset */,
            undefined /* limit */,
            "creationTime" /* order by */,
            "ASC",
            "" /* empty search term returns any */,
        );
        let isCompleted = false;
        for (const row of rows) {
            isCompleted = await this.teamDB.hasActiveSSO(row.id);
            if (isCompleted) {
                break;
            }
        }
        return {
            isCompleted,
            organizationCountTotal: rows.length,
        };
    }

    async getInstallationWorkspaceClasses(userId: string): Promise<SupportedWorkspaceClass[]> {
        if (await isWorkspaceClassDiscoveryEnabled({ id: userId })) {
            const allClasses = (await this.clientProvider.getAllWorkspaceClusters()).flatMap((cluster) => {
                return (cluster.availableWorkspaceClasses || [])?.map((cls) => {
                    return <SupportedWorkspaceClass>{
                        description: cls.description,
                        displayName: cls.displayName,
                        id: cls.id,
                        isDefault: cls.id === cluster.preferredWorkspaceClass,
                    };
                });
            });
            allClasses.sort((a, b) => a.displayName.localeCompare(b.displayName));
            const uniqueClasses = allClasses.filter((v, i, a) => a.map((c) => c.id).indexOf(v.id) == i);

            return uniqueClasses;
        }

        // No access check required, valid session/user is enough
        const classes = this.config.workspaceClasses.map((c) => ({
            id: c.id,
            category: c.category,
            displayName: c.displayName,
            description: c.description,
            powerups: c.powerups,
            isDefault: c.isDefault,
        }));
        return classes;
    }

    async getInstallationConfiguration(): Promise<Configuration> {
        // everybody can read this configuration
        return {
            isDedicatedInstallation: this.config.isDedicatedInstallation,
        };
    }
}

export async function isWorkspaceClassDiscoveryEnabled(user: { id: string }): Promise<boolean> {
    return getExperimentsClientForBackend().getValueAsync("workspace_class_discovery_enabled", false, {
        user: user,
    });
}

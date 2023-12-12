/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdminGetListRequest, AdminGetListResult, EmailDomainFilterEntry, GitpodServer } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { EmailDomainFilterDB, TeamDB } from "@gitpod/gitpod-db/lib";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import { Authorizer } from "../authorization/authorizer";
import { BlockedRepositoryDB } from "@gitpod/gitpod-db/lib/blocked-repository-db";
import { Config } from "../config";

@injectable()
export class InstallationService {
    @inject(Config) private readonly config: Config;
    @inject(Authorizer) private readonly auth: Authorizer;
    @inject(BlockedRepositoryDB) private readonly blockedRepositoryDB: BlockedRepositoryDB;
    @inject(EmailDomainFilterDB) private readonly emailDomainFilterDB: EmailDomainFilterDB;
    @inject(TeamDB) private readonly teamDB: TeamDB;

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
        opts: Pick<BlockedRepository, "urlRegexp" | "blockUser">,
    ): Promise<BlockedRepository> {
        await this.auth.checkPermissionOnInstallation(userId, "configure");
        return this.blockedRepositoryDB.createBlockedRepository(opts.urlRegexp, opts.blockUser);
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
            1 /* limit */,
            "creationTime" /* order by */,
            "ASC",
            "" /* empty search term returns any */,
        );
        const hasAnyOrg = rows.length > 0;
        let isCompleted = false;
        for (const row of rows) {
            isCompleted = await this.teamDB.hasActiveSSO(row.id);
            if (isCompleted) {
                break;
            }
        }
        return {
            isCompleted,
            hasAnyOrg,
        };
    }
}

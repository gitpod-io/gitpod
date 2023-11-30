/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdminGetListRequest, AdminGetListResult, EmailDomainFilterEntry } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { EmailDomainFilterDB } from "@gitpod/gitpod-db/lib";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import { Authorizer } from "../authorization/authorizer";
import { BlockedRepositoryDB } from "@gitpod/gitpod-db/lib/blocked-repository-db";

@injectable()
export class InstallationService {
    @inject(Authorizer) private readonly auth: Authorizer;
    @inject(BlockedRepositoryDB) private readonly blockedRepositoryDB: BlockedRepositoryDB;
    @inject(EmailDomainFilterDB) private readonly emailDomainFilterDB: EmailDomainFilterDB;

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
}

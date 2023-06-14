/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBWorkspace, TypeORM, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Workspace } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";
import { Job } from "./runner";

interface MigrationState {
    migratedUpToCreationDate: string;
}

@injectable()
export class OrgOnlyMigrationJob implements Job<MigrationState> {
    @inject(UserToTeamMigrationService) protected readonly migrationService: UserToTeamMigrationService;
    @inject(TypeORM) protected readonly db: TypeORM;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;

    public readonly name = "org-only-migration-job";
    public frequencyMs = 5 * 60 * 1000; // every 5 minutes

    public async migrateWorkspaces(limit: number, newerThan: string): Promise<Workspace[]> {
        try {
            const workspaceRepo = (await this.db.getConnection()).manager.getRepository<DBWorkspace>(DBWorkspace);
            const workspaces = await workspaceRepo
                .createQueryBuilder("ws")
                .where("ws.organizationId IS NULL")
                .andWhere("contentDeletedTime = ''")
                .andWhere("creationTime > :newerThan", { newerThan })
                .orderBy("creationTime", "ASC")
                .limit(limit)
                .getMany();

            const result: Workspace[] = [];
            for (const ws of workspaces) {
                const user = await this.userDB.findUserById(ws.ownerId);
                if (!user) {
                    log.error({ userId: ws.ownerId, workspaceId: ws.id }, "No user found for workspace");
                    continue;
                }
                const org = await this.migrationService.getUserOrganization(user);
                const wsInfos = await this.workspaceDB.find({ userId: ws.ownerId });
                const migrated = await this.migrationService.updateWorkspacesOrganizationId(wsInfos, org.id);
                result.push(...migrated.map((wsInfo) => wsInfo.workspace));
            }
            log.info("org-only-migration-job: migrated workspaces", { count: result.length });
            return result;
        } catch (err) {
            log.error("org-only-migration-job: error during run", err);
            throw err;
        }
    }

    public async run(state?: MigrationState): Promise<MigrationState> {
        const migratedWorkspaces = await this.migrateWorkspaces(3000, state?.migratedUpToCreationDate || "1900-01-01"); // in prod we do ~300 / minute
        if (migratedWorkspaces.length > 0) {
            const migratedWorkspace = migratedWorkspaces[migratedWorkspaces.length - 1];
            return {
                migratedUpToCreationDate: migratedWorkspace.creationTime,
            };
        }
        return {
            migratedUpToCreationDate: new Date().toISOString(),
        };
    }
}

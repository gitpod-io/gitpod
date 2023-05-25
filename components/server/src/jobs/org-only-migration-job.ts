/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";
import { DBUser, TypeORM, UserDB } from "@gitpod/gitpod-db/lib";
import { User } from "@gitpod/gitpod-protocol";

interface MigrationState {
    migratedUpToCreationDate: string;
}

@injectable()
export class OrgOnlyMigrationJob implements Job<MigrationState> {
    @inject(UserToTeamMigrationService) protected readonly migrationService: UserToTeamMigrationService;
    @inject(TypeORM) protected readonly db: TypeORM;
    @inject(UserDB) protected readonly userDB: UserDB;

    public readonly name = "org-only-migration-job";
    public frequencyMs = 5 * 60 * 1000; // every 5 minutes

    public async migrateUsers(limit: number, usersNewerThan: string): Promise<User[]> {
        try {
            const userRepo = (await this.db.getConnection()).manager.getRepository<DBUser>(DBUser);
            const users = await userRepo
                .createQueryBuilder("user")
                .leftJoinAndSelect("user.identities", "identity")
                .where("user.creationDate > :usersNewerThan", { usersNewerThan })
                .andWhere("additionalData->>'$.isMigratedToTeamOnlyAttribution' IS NULL")
                .orWhere("additionalData->>'$.isMigratedToTeamOnlyAttribution' != 'true'")
                .orderBy("user.creationDate", "ASC")
                .limit(limit)
                .getMany();

            const result: User[] = [];
            for (const user of users) {
                result.push(await this.migrationService.migrateUser(user, true, this.name));
            }
            log.info("org-only-migration-job: migrated users", { count: result.length });
            return result;
        } catch (err) {
            log.error("org-only-migration-job: error during run", err);
            throw err;
        }
    }

    public async run(state?: MigrationState): Promise<MigrationState> {
        const migratedUsers = await this.migrateUsers(3000, state?.migratedUpToCreationDate || "1900-01-01"); // in prod we do ~300 / minute
        if (migratedUsers.length > 0) {
            const lastUser = migratedUsers[migratedUsers.length - 1];
            return {
                migratedUpToCreationDate: lastUser.creationDate,
            };
        }
        return {
            migratedUpToCreationDate: new Date().toISOString(),
        };
    }
}

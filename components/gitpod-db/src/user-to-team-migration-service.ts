/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdditionalUserData, Team, User } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { inject, injectable } from "inversify";
import { ProjectDB } from "./project-db";
import { TeamDB } from "./team-db";
import { ResponseError } from "vscode-jsonrpc";
import { WorkspaceDB } from "./workspace-db";
import { TypeORM } from "./typeorm/typeorm";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { UserDB } from "./user-db";
import { Synchronizer } from "./typeorm/synchronizer";

@injectable()
export class UserToTeamMigrationService {
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;
    @inject(TypeORM) protected readonly typeorm: TypeORM;
    @inject(Synchronizer) protected readonly synchronizer: Synchronizer;

    async migrateUser(candidate: User): Promise<User> {
        // do a quick check before going into synchonization for the common case that the user has been migrated already
        if (!(await this.needsMigration(candidate))) {
            return candidate;
        }
        return this.synchronizer.synchronized("migrate-" + candidate.id, "migrateUser", async () => {
            const user = (await this.userDB.findUserById(candidate.id)) as User;
            if (!(await this.needsMigration(user))) {
                return user;
            }
            AdditionalUserData.set(user, { isMigratedToTeamOnlyAttribution: true });
            await this.userDB.storeUser(user);
            try {
                await this.internalMigrateUser(user);
            } catch (error) {
                log.error("Failed to migrate user to team.", error);
                AdditionalUserData.set(user, { isMigratedToTeamOnlyAttribution: false });
                await this.userDB.storeUser(user);
            }
            return user;
        });
    }

    private async internalMigrateUser(user: User): Promise<Team> {
        const ctx: LogContext = { userId: user.id };
        log.info(ctx, "Creating team of one.");
        let team;
        let tries = 0;
        while (!team && tries++ < 10) {
            try {
                let name = user.fullName || user.name || user.id;
                if (tries > 1) {
                    name = name + " " + tries;
                }
                team = await this.teamDB.createTeam(user.id, name);
            } catch (err) {
                if (err instanceof ResponseError) {
                    if (err.code === ErrorCodes.CONFLICT) {
                        continue;
                    }
                }
                throw err;
            }
        }
        if (!team) {
            throw new ResponseError(ErrorCodes.CONFLICT, "Could not create team for user.", { userId: user.id });
        }
        // add membership
        await this.teamDB.addMemberToTeam(user.id, team.id);
        await this.teamDB.setTeamMemberRole(user.id, team.id, "owner");

        const projects = await this.projectDB.findUserProjects(user.id);
        log.info(ctx, "Migrating projects.", { teamId: team.id, projects: projects.map((p) => p.id) });
        for (const project of projects) {
            project.teamId = team.id;
            project.userId = "";
            await this.projectDB.storeProject(project);
        }

        const conn = await this.typeorm.getConnection();
        const oldAttribution = "user:" + user.id;
        const newAttribution = "team:" + team.id;

        // update default cost center if necessary
        if (user.usageAttributionId === oldAttribution || !user.usageAttributionId) {
            user.usageAttributionId = newAttribution;
            await this.userDB.storeUser(user);
        }

        let result = await conn.query("UPDATE d_b_cost_center SET id = ? WHERE id = ?", [
            newAttribution,
            oldAttribution,
        ]);
        if (result.affectedRows === 0) {
            const now = new Date();
            const nextMonth = new Date();
            nextMonth.setMonth(now.getMonth() + 1);
            await conn.query(
                "INSERT INTO d_b_cost_center (id, creationTime, spendingLimit, billingStrategy, billingCycleStart, nextBillingTime) VALUES (?,?,?,?,?,?)",
                [newAttribution, now.toISOString(), 500, "other", now.toISOString(), nextMonth.toISOString()],
            );
            log.info(ctx, "Created cost center data.", { teamId: team.id, result });
        } else {
            log.info(ctx, "Migrated cost center data.", { teamId: team.id, result });
        }

        result = await conn.query(
            "UPDATE d_b_workspace_instance SET usageAttributionId = ? WHERE usageAttributionId = ?",
            [newAttribution, oldAttribution],
        );
        log.info(ctx, "Migrated workspace instances.", { teamId: team.id, result });

        result = await conn.query("UPDATE d_b_usage SET attributionId = ? WHERE attributionId = ?", [
            newAttribution,
            oldAttribution,
        ]);
        log.info(ctx, "Migrated usage data.", { teamId: team.id, result });

        result = await conn.query("UPDATE d_b_stripe_customer SET attributionid = ? WHERE attributionid = ?", [
            newAttribution,
            oldAttribution,
        ]);
        log.info(ctx, "Migrated stripe customer data.", { teamId: team.id, result });
        return team;
    }

    async needsMigration(user: User): Promise<boolean> {
        const teams = await this.teamDB.findTeamsByUser(user.id);
        return teams.length === 0 || !user.additionalData?.isMigratedToTeamOnlyAttribution;
    }
}

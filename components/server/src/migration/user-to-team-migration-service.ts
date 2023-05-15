/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, TeamDB, TypeORM, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { Synchronizer } from "@gitpod/gitpod-db/lib/typeorm/synchronizer";
import { AdditionalUserData, Team, User, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { ResponseError } from "vscode-jsonrpc";
import { StripeService } from "../user/stripe-service";

@injectable()
export class UserToTeamMigrationService {
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;
    @inject(TypeORM) protected readonly typeorm: TypeORM;
    @inject(Synchronizer) protected readonly synchronizer: Synchronizer;
    @inject(StripeService) protected readonly stripeService: StripeService;

    async migrateUser(candidate: User): Promise<User> {
        // do a quick check before going into synchonization for the common case that the user has been migrated already
        if (!(await this.needsMigration(candidate))) {
            return candidate;
        }
        return this.synchronizer.synchronized("migrate-" + candidate.id, "migrateUser", async () => {
            if (!(await this.needsMigration(candidate))) {
                return candidate;
            }
            // refetch user from the db to ensure it was not migrated in the meantime
            const refetched = await this.userDB.findUserById(candidate.id);
            if (refetched && !(await this.needsMigration(refetched))) {
                return refetched;
            }
            AdditionalUserData.set(candidate, { isMigratedToTeamOnlyAttribution: true });
            await this.userDB.storeUser(candidate);
            try {
                await this.internalMigrateUser(candidate);
            } catch (error) {
                log.error("Failed to migrate user to team.", error);
                AdditionalUserData.set(candidate, { isMigratedToTeamOnlyAttribution: false });
                await this.userDB.storeUser(candidate);
            }
            return candidate;
        });
    }

    private async internalMigrateUser(user: User): Promise<Team> {
        const ctx: LogContext = { userId: user.id };
        let orgName = (user.fullName || user.name || "").trim();
        if (orgName.length === 0) {
            orgName = "My Organization";
        }
        if (orgName.length > 64) {
            orgName = orgName.substring(0, 64);
        }
        if (orgName.length <= 3) {
            // artificially extend name to avoid blocking users
            orgName = orgName + " Organization";
        }
        log.info(ctx, "Creating org of one.", { orgName });
        let team;
        let tries = 0;
        while (!team && tries++ < 10) {
            try {
                if (tries > 1) {
                    orgName = orgName + " " + tries;
                }
                team = await this.teamDB.createTeam(user.id, orgName);
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

        result = await conn.query(
            `
                UPDATE d_b_workspace w
                JOIN d_b_workspace_instance wi
                ON w.id = wi.workspaceid
                SET w.organizationId = ?
                WHERE wi.usageAttributionId = ?
            `,
            [team.id, newAttribution],
        );
        log.info(ctx, "Migrated workspaces.", { teamId: team.id, result });

        // Ensure there are no workspaces without an organizationId. This is necessary because very old workspace instance don't have an attributionId.
        const workspaces = await this.workspaceDB.find({
            userId: user.id,
        });
        await this.updateWorkspacesOrganizationId(workspaces, team.id);
        log.info(ctx, "Updated workspaces.", { teamId: team.id });

        result = await conn.query("UPDATE d_b_usage SET attributionId = ? WHERE attributionId = ?", [
            newAttribution,
            oldAttribution,
        ]);
        log.info(ctx, "Migrated usage data.", { teamId: team.id, result });

        const stripeCustomer = await conn.query(
            "SELECT stripeCustomerId FROM d_b_stripe_customer WHERE attributionid = ? AND deleted = 0",
            [oldAttribution],
        );

        if (stripeCustomer.length > 0) {
            const stripeCustomerId = stripeCustomer[0].stripeId;
            // update the metadata['attributionid'] on the stripe customer in stripe
            try {
                await this.stripeService.updateAttributionId(stripeCustomerId, newAttribution, oldAttribution);
                // delete the record from the db so it gets repopulated on next use
                result = await conn.query("DELETE FROM d_b_stripe_customer WHERE attributionid = ?", [oldAttribution]);
                log.info(ctx, "Migrated stripe customer data.", {
                    teamId: team.id,
                    stripeId: stripeCustomerId,
                    result,
                });
            } catch (error) {
                log.error(ctx, "Failed to migrate stripe customer data.", {
                    teamId: team.id,
                    stripeId: stripeCustomerId,
                    error,
                });
            }
        }

        return team;
    }

    async needsMigration(user: User): Promise<boolean> {
        const teams = await this.teamDB.findTeamsByUser(user.id);
        return teams.length === 0 || !user.additionalData?.isMigratedToTeamOnlyAttribution;
    }

    async updateWorkspacesOrganizationId(workspaces: WorkspaceInfo[], userOrgId: string): Promise<WorkspaceInfo[]> {
        return await Promise.all(
            workspaces.map(async (ws) => {
                if (!ws.workspace.organizationId) {
                    const attrId =
                        ws.latestInstance?.usageAttributionId &&
                        AttributionId.parse(ws.latestInstance.usageAttributionId);
                    if (attrId && attrId.kind === "team") {
                        ws.workspace.organizationId = attrId.teamId;
                    } else {
                        ws.workspace.organizationId = userOrgId;
                    }
                    await this.workspaceDB.updatePartial(ws.workspace.id, {
                        organizationId: ws.workspace.organizationId,
                    });
                }
                return ws;
            }),
        );
    }

    async getUserOrganization(user: User): Promise<Team> {
        const teams = await this.teamDB.findTeamsByUser(user.id);
        return teams.find((t) => t.name === user.name || t.name === user.fullName) || teams[0];
    }
}

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, TeamDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { AdditionalUserData, Organization, User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Authorizer, isFgaWritesEnabled } from "./authorizer";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { v1 } from "@authzed/authzed-node";
import { fgaRelationsUpdateClientLatency } from "../prometheus-metrics";
import { RedisMutex } from "../redis/mutex";
import { rel } from "./definitions";

@injectable()
export class RelationshipUpdater {
    public static readonly version = 2;

    constructor(
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(TeamDB) private readonly orgDB: TeamDB,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(WorkspaceDB) private readonly workspaceDB: WorkspaceDB,
        @inject(Authorizer) private readonly authorizer: Authorizer,
        @inject(RedisMutex) private readonly mutex: RedisMutex,
    ) {}

    /**
     * Updates all relationships for a user according to the current state of the database.
     *
     * if the user's `fgaRelationshipsVersion` equals the version (see above) of this class already, this is a no-op.
     * Otherwise, all relationships are updated indempotently and the user's `fgaRelationshipsVersion` is set to the
     * current version.
     *
     * @param user
     * @returns
     */
    public async migrate(user: User): Promise<User> {
        const isEnabled = await isFgaWritesEnabled(user.id);
        if (!isEnabled) {
            if (user.additionalData?.fgaRelationshipsVersion !== undefined) {
                log.info({ userId: user.id }, `User has been removed from FGA.`);
                // reset the fgaRelationshipsVersion to undefined, so the migration is triggered again when the feature is enabled
                AdditionalUserData.set(user, { fgaRelationshipsVersion: undefined });
                return await this.userDB.storeUser(user);
            }
            return user;
        }
        if (await this.isMigrated(user)) {
            return user;
        }
        const stopTimer = fgaRelationsUpdateClientLatency.startTimer();
        try {
            return await this.mutex.using([`fga-migration-${user.id}`], 2000, async () => {
                const before = new Date().getTime();

                const updatedUser = await this.userDB.findUserById(user.id);
                if (!updatedUser) {
                    throw new ApplicationError(ErrorCodes.NOT_FOUND, "User not found");
                }
                user = updatedUser;
                if (await this.isMigrated(user)) {
                    return user;
                }
                log.info({ userId: user.id }, `Updating FGA relationships for user.`, {
                    fromVersion: user?.additionalData?.fgaRelationshipsVersion,
                    toVersion: RelationshipUpdater.version,
                });
                const orgs = await this.findAffectedOrganizations(user.id);

                // Add relationships
                await this.updateUser(user);
                for (const org of orgs) {
                    await this.updateOrganization(user.id, org);
                }
                await this.updateWorkspaces(user);
                AdditionalUserData.set(user, {
                    fgaRelationshipsVersion: RelationshipUpdater.version,
                });
                await this.userDB.updateUserPartial({
                    id: user.id,
                    additionalData: user.additionalData,
                });
                log.info({ userId: user.id }, `Finished updating relationships.`, {
                    duration: new Date().getTime() - before,
                });

                // let's double check the migration worked.
                if (!(await this.isMigrated(user))) {
                    log.error({ userId: user.id }, `User migration failed.`, {
                        markedMigrated: user.additionalData?.fgaRelationshipsVersion === RelationshipUpdater.version,
                    });
                }
                return user;
            });
        } finally {
            fgaRelationsUpdateClientLatency.observe(stopTimer());
        }
    }

    private async isMigrated(user: User) {
        const isMigrated = user.additionalData?.fgaRelationshipsVersion === RelationshipUpdater.version;
        if (isMigrated) {
            const hasSelfRelationship = await this.authorizer.find(rel.user(user.id).self.user(user.id));
            if (!hasSelfRelationship) {
                log.warn({ userId: user.id }, `User is marked as migrated but doesn't have self relationship.`);
                //TODO(se) this is an extra safety net to detect
                // reset the fgaRelationshipsVersion to undefined, so the migration is triggered again when the feature is enabled
                AdditionalUserData.set(user, { fgaRelationshipsVersion: undefined });
                await this.userDB.updateUserPartial({
                    id: user.id,
                    additionalData: user.additionalData,
                });
                return false;
            }
        }
        return isMigrated;
    }

    private async findAffectedOrganizations(userId: string): Promise<Organization[]> {
        const orgs = await this.orgDB.findTeamsByUser(userId);
        const orgRelations = await this.authorizer.findAll(
            v1.Relationship.create({
                subject: {
                    object: {
                        objectType: "user",
                        objectId: userId,
                    },
                },
                resource: {
                    objectType: "organization",
                },
            }),
        );
        for (const rel of orgRelations) {
            const orgId = rel.resource?.objectId;
            if (orgId && !orgs.find((o) => o.id === orgId)) {
                const org = await this.orgDB.findTeamById(orgId);
                if (org) {
                    orgs.push(org);
                }
            }
        }
        return orgs;
    }

    private async updateWorkspaces(user: User): Promise<void> {
        const workspaces = await this.workspaceDB.find({
            userId: user.id,
            includeHeadless: false,
            includeWithoutProject: true,
            limit: 500, // The largest amount of workspaces is 189 today (2023-08-24)
        });

        await this.authorizer.bulkAddWorkspaceToOrg(
            workspaces.map((ws) => ({
                orgID: ws.workspace.organizationId,
                userID: ws.workspace.ownerId,
                workspaceID: ws.workspace.id,
                shared: !!ws.workspace.shareable,
            })),
        );
    }

    private async updateUser(user: User): Promise<void> {
        await this.authorizer.addUser(user.id, user.organizationId);
        if (!user.organizationId) {
            if ((user.rolesOrPermissions || []).includes("admin")) {
                await this.authorizer.addInstallationAdminRole(user.id);
            } else {
                await this.authorizer.removeInstallationAdminRole(user.id);
            }
        } else {
            await this.authorizer.removeInstallationAdminRole(user.id);
        }
    }

    private async updateOrganization(userId: string, org: Organization): Promise<void> {
        const members = await this.orgDB.findMembersByTeam(org.id);
        const projects = await this.projectDB.findProjects(org.id);
        await this.authorizer.addOrganization(
            userId,
            org.id,
            members,
            projects.map((p) => p.id),
        );
    }
}

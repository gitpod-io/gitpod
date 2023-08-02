/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, TeamDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { AdditionalUserData, Organization, User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Authorizer } from "./authorizer";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class RelationshipUpdater {
    public readonly version = 1;

    constructor(
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(TeamDB) private readonly orgDB: TeamDB,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(WorkspaceDB) private readonly workspaceDB: WorkspaceDB,
        @inject(Authorizer) private readonly authorizer: Authorizer,
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
        if (user.additionalData?.fgaRelationshipsVersion === this.version) {
            return user;
        }
        // TODO run in distributed lock
        // return this.mutex.using([`fga-migration-${user.id}`], 2000, async () => {
        const before = new Date().getTime();

        const updatedUser = await this.userDB.findUserById(user.id);
        if (!updatedUser) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "User not found");
        }
        user = updatedUser;
        if (user.additionalData?.fgaRelationshipsVersion === this.version) {
            return user;
        }
        log.info({ userId: user.id }, `Updating FGA relationships for user.`, {
            fromVersion: user?.additionalData?.fgaRelationshipsVersion,
            toVersion: this.version,
        });
        const orgs = await this.orgDB.findTeamsByUser(user.id);

        //TODO only remove relations that should no longer be there. Removing everything will break concurrent access.
        await this.authorizer.removeAllRelationships("user", user.id);
        for (const org of orgs) {
            await this.authorizer.removeAllRelationships("organization", org.id);
        }

        // Add relationships
        await this.updateUser(user);
        for (const org of orgs) {
            await this.updateOrganization(org);
        }

        await this.createRelationsToWorkspaces(user);

        AdditionalUserData.set(user, {
            fgaRelationshipsVersion: this.version,
        });
        await this.userDB.updateUserPartial({
            id: user.id,
            additionalData: user.additionalData,
        });
        log.info({ userId: user.id }, `Finished updating relationships.`, {
            duration: new Date().getTime() - before,
        });
        return user;
        // });
    }

    private async createRelationsToWorkspaces(user: User): Promise<void> {
        // Because the total amount of workspaces per user can be very large, we want to paginate through them.
        const CHUNK_SIZE = 1000;
        let minCreationTime = undefined;
        while (true) {
            const workspaces = await this.workspaceDB.findAllWorkspaces(0, CHUNK_SIZE, "creationTime", "ASC", {
                ownerId: user.id,
                minCreationTime,
            });
            if (workspaces.rows.length === 0) {
                // We are done here
                break;
            }

            await this.authorizer.bulkCreateWorkspaceInOrg(
                workspaces.rows.map((ws) => ({ orgID: ws.organizationId, userID: ws.ownerId, workspaceID: ws.id })),
            );
            minCreationTime = workspaces.rows[workspaces.rows.length - 1].creationTime;

            if (workspaces.rows.length < CHUNK_SIZE) {
                // We are done here as well, no need to ask the DB again
                break;
            }
        }
    }

    private async updateUser(user: User): Promise<void> {
        await this.authorizer.addUser(user.id, user.organizationId);
        if (!user.organizationId) {
            await this.authorizer.addInstallationMemberRole(user.id);
            if ((user.rolesOrPermissions || []).includes("admin")) {
                await this.authorizer.addInstallationAdminRole(user.id);
            }
        }
    }

    private async updateOrganization(org: Organization): Promise<void> {
        const members = await this.orgDB.findMembersByTeam(org.id);
        const projects = await this.projectDB.findProjects(org.id);
        await this.authorizer.addOrganization(org, members, projects);
    }
}

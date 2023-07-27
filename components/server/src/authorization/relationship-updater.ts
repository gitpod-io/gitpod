/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ProjectDB, TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import { AdditionalUserData, Organization, User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { RedisMutex } from "../redis/mutex";
import { Authorizer } from "./authorizer";

@injectable()
export class RelationshipUpdater {
    public readonly version = 1;

    constructor(
        @inject(RedisMutex) private readonly mutex: RedisMutex,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(TeamDB) private readonly orgDB: TeamDB,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(Authorizer) private readonly authorizer: Authorizer,
    ) {}

    /**
     * Updates all relationships for a user according to the current state of the database.
     * @param user
     * @returns
     */
    public async migrate(user: User): Promise<User> {
        if (user?.additionalData?.fgaRelationshipsVersion === this.version) {
            return user;
        }
        return this.mutex.using([`fga-migration-${user.id}`], 2000, async () => {
            const before = new Date().getTime();
            try {
                log.info({ userId: user.id }, `Updating FGA relationships for user.`, {
                    fromVersion: user?.additionalData?.fgaRelationshipsVersion,
                    toVersion: this.version,
                });
                const orgs = await this.orgDB.findTeamsByUser(user.id);

                // clean up relationships
                await this.authorizer.removeAllRelationships("user", user.id);
                for (const org of orgs) {
                    await this.authorizer.removeAllRelationships("organization", org.id);
                }

                // Add relationships
                await this.updateUser(user);
                for (const org of orgs) {
                    await this.updateOrganization(org);
                }
                return user;
            } finally {
                AdditionalUserData.set(user, {
                    fgaRelationshipsVersion: this.version,
                });
                await this.userDB.updateUserPartial(user);
                log.info({ userId: user.id }, `Finished updating relationships.`, {
                    duration: new Date().getTime() - before,
                });
            }
        });
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

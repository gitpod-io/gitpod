/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB } from "@gitpod/gitpod-db/lib";
import { Organization, TeamMembershipInvite } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/authorizer";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { OrganizationPermission } from "../authorization/definitions";

@injectable()
export class OrganizationService {
    constructor(
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(Authorizer) private readonly auth: Authorizer,
    ) {}
    /**
     * createOrganization creates a new organization
     */
    async createOrganization(userId: string, name: string): Promise<Organization> {
        let result: Organization;
        try {
            result = await this.teamDB.transaction(async (db) => {
                result = await db.createTeam(userId, name);
                await this.auth.addOrganizationOwnerRole(result.id, userId);
                return result;
            });
        } catch (err) {
            if (result! && result.id) {
                await this.auth.removeUserFromOrg(result.id, userId);
            }

            throw err;
        }
        return result;
    }

    /**
     * getGenericInvite returns the generic invite for the given organization or creates one if no invite exists.
     *
     * @param userId
     * @param orgID
     * @returns
     */
    public async getOrCreateInvite(userId: string, orgID: string): Promise<TeamMembershipInvite> {
        await this.checkPermissionAndThrow(userId, "invite_members", orgID);
        const invite = await this.teamDB.findGenericInviteByTeamId(orgID);
        if (invite) {
            if (await this.teamDB.hasActiveSSO(orgID)) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
            }
            return invite;
        }
        return this.resetInvite(userId, orgID);
    }

    public async resetInvite(userId: string, orgID: string): Promise<TeamMembershipInvite> {
        await this.checkPermissionAndThrow(userId, "invite_members", orgID);
        if (await this.teamDB.hasActiveSSO(orgID)) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }
        return this.teamDB.resetGenericInvite(orgID);
    }

    private async checkPermissionAndThrow(userId: string, permission: OrganizationPermission, orgID: string) {
        if (await this.auth.hasPermissionOnOrganization(userId, permission, orgID)) {
            return;
        }
        // check if the user has read permission
        if ("read_info" === permission || !(await this.auth.hasPermissionOnOrganization(userId, "read_info", orgID))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Organization ${orgID} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on organization ${orgID}`,
        );
    }
}

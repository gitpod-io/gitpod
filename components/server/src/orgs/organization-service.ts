/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import {
    OrgMemberInfo,
    OrgMemberRole,
    Organization,
    OrganizationSettings,
    TeamMembershipInvite,
} from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/authorizer";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ProjectsService } from "../projects/projects-service";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";

@injectable()
export class OrganizationService {
    constructor(
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(ProjectsService) private readonly projectsService: ProjectsService,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
    ) {}

    async listOrganizationsByMember(userId: string, memberId: string): Promise<Organization[]> {
        //TODO check if user has access to member
        const orgs = await this.teamDB.findTeamsByUser(memberId);
        const result: Organization[] = [];
        for (const org of orgs) {
            if (await this.auth.hasPermissionOnOrganization(userId, "read_info", org.id)) {
                result.push(org);
            }
        }
        return result;
    }

    async getOrganization(userId: string, orgId: string): Promise<Organization> {
        await this.auth.checkOrgPermissionAndThrow(userId, "read_info", orgId);
        const result = await this.teamDB.findTeamById(orgId);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Organization ${orgId} not found`);
        }
        return result;
    }

    async updateOrganization(
        userId: string,
        orgId: string,
        changes: Pick<Organization, "name">,
    ): Promise<Organization> {
        await this.auth.checkOrgPermissionAndThrow(userId, "write_info", orgId);
        return this.teamDB.updateTeam(orgId, changes);
    }

    async createOrganization(userId: string, name: string): Promise<Organization> {
        let result: Organization;
        try {
            result = await this.teamDB.transaction(async (db) => {
                result = await db.createTeam(userId, name);
                const members = await db.findMembersByTeam(result.id);
                await this.auth.addOrganization(result, members, []);
                return result;
            });
        } catch (err) {
            if (result! && result.id) {
                await this.auth.removeUserFromOrg(result.id, userId);
            }

            throw err;
        }
        this.analytics.track({
            userId,
            event: "team_created",
            properties: {
                id: result.id,
                name: result.name,
                created_at: result.creationTime,
            },
        });
        return result;
    }

    public async deleteOrganization(userId: string, orgId: string): Promise<void> {
        await this.auth.checkOrgPermissionAndThrow(userId, "delete", orgId);
        const projects = await this.projectsService.getProjects(userId, orgId);

        const members = await this.teamDB.findMembersByTeam(orgId);
        try {
            await this.teamDB.transaction(async (db, ctx) => {
                for (const project of projects) {
                    await this.projectsService.deleteProject(userId, project.id, ctx);
                }
                for (const member of members) {
                    await db.removeMemberFromTeam(member.userId, orgId);
                }

                await db.deleteTeam(orgId);

                await this.auth.deleteOrganization(orgId);
            });
            return this.analytics.track({
                userId: userId,
                event: "team_deleted",
                properties: {
                    team_id: orgId,
                },
            });
        } catch (err) {
            const org = await this.teamDB.findTeamById(orgId);
            await this.auth.addOrganization(org!, members, projects);
        }
    }

    public async listMembers(userId: string, orgId: string): Promise<OrgMemberInfo[]> {
        await this.auth.checkOrgPermissionAndThrow(userId, "read_members", orgId);
        return this.teamDB.findMembersByTeam(orgId);
    }

    public async getOrCreateInvite(userId: string, orgId: string): Promise<TeamMembershipInvite> {
        await this.auth.checkOrgPermissionAndThrow(userId, "invite_members", orgId);
        const invite = await this.teamDB.findGenericInviteByTeamId(orgId);
        if (invite) {
            if (await this.teamDB.hasActiveSSO(orgId)) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
            }
            return invite;
        }
        return this.resetInvite(userId, orgId);
    }

    public async resetInvite(userId: string, orgId: string): Promise<TeamMembershipInvite> {
        await this.auth.checkOrgPermissionAndThrow(userId, "invite_members", orgId);
        if (await this.teamDB.hasActiveSSO(orgId)) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }
        return this.teamDB.resetGenericInvite(orgId);
    }

    public async joinOrganization(userId: string, inviteId: string): Promise<string> {
        // Invites can be used by anyone, as long as they know the invite ID, hence needs no resource guard
        const invite = await this.teamDB.findTeamMembershipInviteById(inviteId);
        if (!invite || invite.invalidationTime !== "") {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "The invite link is no longer valid.");
        }
        if (await this.teamDB.hasActiveSSO(invite.teamId)) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }
        try {
            return await this.teamDB.transaction(async (db) => {
                await this.teamDB.addMemberToTeam(userId, invite.teamId);
                await this.auth.addOrganizationRole(invite.teamId, userId, invite.role);
                this.analytics.track({
                    userId: userId,
                    event: "team_joined",
                    properties: {
                        team_id: invite.teamId,
                        invite_id: inviteId,
                    },
                });
                return invite.teamId;
            });
        } catch (err) {
            await this.auth.removeUserFromOrg(invite.teamId, userId);
            throw err;
        }
    }

    public async setOrganizationMemberRole(
        userId: string,
        orgId: string,
        memberId: string,
        role: OrgMemberRole,
    ): Promise<void> {
        await this.auth.checkOrgPermissionAndThrow(userId, "write_members", orgId);
        if (role !== "owner") {
            const members = await this.teamDB.findMembersByTeam(orgId);
            if (!members.some((m) => m.userId !== memberId && m.role === "owner")) {
                throw new ApplicationError(ErrorCodes.CONFLICT, "Cannot remove the last owner of an organization.");
            }
        }

        try {
            await this.teamDB.transaction(async (db) => {
                await db.setTeamMemberRole(memberId, orgId, role);
                await this.auth.addOrganizationRole(orgId, memberId, role);
            });
        } catch (err) {
            await this.auth.removeUserFromOrg(orgId, memberId);

            throw err;
        }
    }

    public async removeOrganizationMember(userId: string, orgId: string, memberId: string): Promise<void> {
        // The user is leaving a team, if they are removing themselves from the team.
        if (userId === memberId) {
            await this.auth.checkOrgPermissionAndThrow(userId, "read_info", orgId);
        } else {
            await this.auth.checkOrgPermissionAndThrow(userId, "write_members", orgId);
        }

        // Check for existing membership.
        const members = await this.teamDB.findMembersByTeam(orgId);
        // cannot remove last owner
        if (!members.some((m) => m.userId !== memberId && m.role === "owner")) {
            throw new ApplicationError(ErrorCodes.CONFLICT, "Cannot remove the last owner of an organization.");
        }

        const membership = members.find((m) => m.userId === memberId);
        if (!membership) {
            throw new ApplicationError(
                ErrorCodes.NOT_FOUND,
                `Could not find membership for user '${memberId}' in organization '${orgId}'`,
            );
        }

        // Check if user's account belongs to the Org.
        const userToBeRemoved = await this.userDB.findUserById(memberId);
        if (!userToBeRemoved) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Could not find user '${memberId}'`);
        }
        // Only invited members can be removed from the Org, but organizational accounts cannot.
        if (userToBeRemoved.organizationId && orgId === userToBeRemoved.organizationId) {
            throw new ApplicationError(
                ErrorCodes.PERMISSION_DENIED,
                `User's account '${memberId}' belongs to the organization '${orgId}'`,
            );
        }

        try {
            await this.teamDB.transaction(async (db) => {
                await db.removeMemberFromTeam(userToBeRemoved.id, orgId);
                await this.auth.removeUserFromOrg(orgId, memberId);
            });
        } catch (err) {
            // Rollback to the original role the user had
            await this.auth.addOrganizationRole(orgId, memberId, membership.role);
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, err);
        }
        this.analytics.track({
            userId,
            event: "team_user_removed",
            properties: {
                team_id: orgId,
                removed_user_id: userId,
            },
        });
    }

    async getSettings(userId: string, orgId: string): Promise<OrganizationSettings> {
        await this.auth.checkOrgPermissionAndThrow(userId, "read_settings", orgId);
        return (await this.teamDB.findOrgSettings(orgId)) || {};
    }

    async updateSettings(userId: string, orgId: string, settings: OrganizationSettings): Promise<OrganizationSettings> {
        await this.auth.checkOrgPermissionAndThrow(userId, "write_settings", orgId);
        await this.teamDB.setOrgSettings(orgId, settings);
        return settings;
    }
}

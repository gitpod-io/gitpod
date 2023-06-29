/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import { OrgMemberInfo, OrgMemberRole, Organization } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/perms";
import { addOrganizationOwnerRole, organizationRole, removeUserFromOrg } from "../authorization/relationships";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ResponseError } from "vscode-ws-jsonrpc";
import { ProjectsService } from "../projects/projects-service";

@injectable()
export class OrganizationService {
    constructor(
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(TeamDB) private readonly orgsDB: TeamDB,
        @inject(ProjectsService) private readonly projectsService: ProjectsService,
        @inject(Authorizer) protected readonly authorizer: Authorizer,
    ) {}

    public async findOrgsByUser(userId: string): Promise<Organization[]> {
        return this.orgsDB.findTeamsByUser(userId);
    }

    public async findMembersByOrg(orgId: string): Promise<OrgMemberInfo[]> {
        return this.orgsDB.findMembersByTeam(orgId);
    }

    public async findOrgById(orgId: string): Promise<Organization | undefined> {
        return this.orgsDB.findTeamById(orgId);
    }

    public async updateOrg(orgId: string, update: Pick<Organization, "name">): Promise<Organization> {
        return this.orgsDB.updateTeam(orgId, update);
    }

    public async createOrg(userId: string, name: string): Promise<Organization> {
        let org: Organization;
        try {
            org = await this.orgsDB.transaction(async (db) => {
                org = await db.createTeam(userId, name);
                await this.authorizer.writeRelationships(addOrganizationOwnerRole(org.id, userId));
                return org;
            });
        } catch (err) {
            if (org! && org.id) {
                await this.authorizer.writeRelationships(removeUserFromOrg(org.id, userId));
            }

            throw err;
        }
        return org;
    }

    public async deleteOrg(ctx: TraceContext, orgId: string) {
        const teamProjects = await this.projectsService.getTeamProjects(orgId);

        teamProjects.forEach((project) => {
            /** no await */ this.projectsService.deleteProject(project.id).catch((err) => {
                /** ignore */
            });
        });

        const teamMembers = await this.orgsDB.findMembersByTeam(orgId);
        teamMembers.forEach((member) => {
            /** no await */ this.removeTeamMember(ctx, {
                currentUserId,
            }).catch((err) => {
                /** ignore */
            });
        });

        // TODO: delete setting
        await this.orgsDB.deleteTeam(orgId);
    }

    public async joinTeam(
        ctx: TraceContext,
        userId: string,
        inviteId: string,
    ): Promise<{
        orgId: string;
        result: "added" | "already_member";
    }> {
        const invite = await this.orgsDB.findTeamMembershipInviteById(inviteId);
        if (!invite || invite.invalidationTime !== "") {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "The invite link is no longer valid.");
        }
        ctx.span?.setTag("teamId", invite.teamId);
        if (await this.orgsDB.hasActiveSSO(invite.teamId)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }
        const result = await this.orgsDB.addMemberToTeam(userId, invite.teamId);
        return {
            result,
            orgId: invite.teamId,
        };
    }

    public async setOrgMemberRole({
        currentUserId,
        targetUserId,
        orgId,
        role,
    }: {
        currentUserId: string;
        targetUserId: string;
        orgId: string;
        role: OrgMemberRole;
    }) {
        try {
            await this.orgsDB.transaction(async (db) => {
                await db.setTeamMemberRole(targetUserId, orgId, role);
                await this.authorizer.writeRelationships(organizationRole(orgId, targetUserId, role), {
                    teamID: orgId,
                    userID: currentUserId,
                });
            });
        } catch (err) {
            await this.authorizer.writeRelationships(removeUserFromOrg(orgId, targetUserId));

            throw err;
        }
    }

    public async removeTeamMember(
        ctx: TraceContext,
        {
            currentUserId,
            targetUserId,
            orgId,
        }: {
            currentUserId: string;
            targetUserId: string;
            orgId: string;
        },
    ) {
        // Check for existing membership.
        const membership = await this.orgsDB.findTeamMembership(targetUserId, orgId);
        if (!membership) {
            throw new ResponseError(
                ErrorCodes.NOT_FOUND,
                `Could not find membership for user '${targetUserId}' in organization '${orgId}'`,
            );
        }

        // Check if user's account belongs to the Org.
        const currentUserLeavingTeam = currentUserId === targetUserId;
        const userToBeRemomved = await this.userDB.findUserById(currentUserLeavingTeam ? currentUserId : targetUserId);
        if (!userToBeRemoved) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Could not find user '${targetUserId}'`);
        }
        // Only invited members can be removed from the Org, but organizational accounts cannot.
        if (userToBeRemoved.organizationId && orgId === userToBeRemoved.organizationId) {
            throw new ResponseError(
                ErrorCodes.PRECONDITION_FAILED,
                `User's account '${targetUserId}' belongs to the organization '${orgId}'`,
            );
        }

        try {
            await this.orgsDB.transaction(async (db) => {
                await db.removeMemberFromTeam(targetUserId, orgId);
                await this.authorizer.writeRelationships(removeUserFromOrg(orgId, targetUserId));
            });
        } catch (err) {
            // Rollback to the original role the user had
            await this.authorizer.writeRelationships(organizationRole(orgId, targetUserId, membership.role));
        }
    }

    public async getGenericInvite(orgId: string) {
        if (await this.orgsDB.hasActiveSSO(orgId)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }

        const invite = await this.orgsDB.findGenericInviteByTeamId(orgId);
        if (invite) {
            return invite;
        }
        return this.orgsDB.resetGenericInvite(orgId);
    }

    public async resetGenericInvite(orgId: string) {
        if (await this.orgsDB.hasActiveSSO(orgId)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }
        return this.orgsDB.resetGenericInvite(orgId);
    }
}

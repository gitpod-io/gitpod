/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BUILTIN_INSTLLATION_ADMIN_USER_ID, TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import {
    OrgMemberInfo,
    OrgMemberRole,
    Organization,
    OrganizationSettings,
    TeamMembershipInvite,
} from "@gitpod/gitpod-protocol";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Authorizer, SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";
import { ProjectsService } from "../projects/projects-service";
import { TransactionalContext } from "@gitpod/gitpod-db/lib/typeorm/transactional-db-impl";
import { DefaultWorkspaceImageValidator } from "./default-workspace-image-validator";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";
import { UserService } from "../user/user-service";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { InstallationService } from "../auth/installation-service";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { runWithSubjectId } from "../util/request-context";
import { IDEService } from "../ide-service";

@injectable()
export class OrganizationService {
    constructor(
        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(UserService) private readonly userService: UserService,
        @inject(ProjectsService) private readonly projectsService: ProjectsService,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(InstallationService) private readonly installationService: InstallationService,
        @inject(IDEService) private readonly ideService: IDEService,
        @inject(DefaultWorkspaceImageValidator)
        private readonly validateDefaultWorkspaceImage: DefaultWorkspaceImageValidator,
    ) {}

    async listOrganizations(
        userId: string,
        req: {
            offset?: number;
            limit?: number;
            orderBy?: keyof Organization;
            orderDir?: "asc" | "desc";
            searchTerm?: string;
        },
        scope?: "member" | "installation",
    ): Promise<{ total: number; rows: Organization[] }> {
        if (scope !== "installation") {
            let result = await this.listOrganizationsByMember(userId, userId);
            result = result.filter((o) => o.name.toLowerCase().includes((req.searchTerm || "").toLowerCase()));
            // apply ordering
            if (req.orderBy) {
                result.sort((a, b) => {
                    const aVal = a[req.orderBy!];
                    const bVal = b[req.orderBy!];
                    if (!aVal && !bVal) {
                        return 0;
                    }
                    if (!aVal) {
                        return req.orderDir === "asc" ? -1 : 1;
                    }
                    if (!bVal) {
                        return req.orderDir === "asc" ? 1 : -1;
                    }
                    if (aVal < bVal) {
                        return req.orderDir === "asc" ? -1 : 1;
                    }
                    if (aVal > bVal) {
                        return req.orderDir === "asc" ? 1 : -1;
                    }
                    return 0;
                });
            }
            return {
                total: result.length,
                rows: result.slice(req.offset || 0, (req.offset || 0) + (req.limit || 50)),
            };
        }
        const result = await this.teamDB.findTeams(
            req.offset || 0,
            req.limit || 50,
            req.orderBy || "creationTime",
            req.orderDir === "asc" ? "ASC" : "DESC",
            req.searchTerm,
        );

        await Promise.all(
            result.rows.map(async (org) => {
                // if the user doesn't see the org, filter it out
                if (!(await this.auth.hasPermissionOnOrganization(userId, "read_info", org.id))) {
                    result.total--;
                    result.rows = result.rows.filter((o) => o.id !== org.id);
                }
            }),
        );

        return result;
    }

    async listOrganizationsByMember(userId: string, memberId: string): Promise<Organization[]> {
        await this.auth.checkPermissionOnUser(userId, "read_info", memberId);
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
        await this.auth.checkPermissionOnOrganization(userId, "read_info", orgId);
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
        await this.auth.checkPermissionOnOrganization(userId, "write_info", orgId);
        return this.teamDB.updateTeam(orgId, changes);
    }

    async createOrganization(userId: string, name: string): Promise<Organization> {
        let result: Organization;
        try {
            result = await this.teamDB.transaction(async (db) => {
                result = await db.createTeam(userId, name);
                const members = await db.findMembersByTeam(result.id);
                await this.auth.addOrganization(userId, result.id, members, []);
                return result;
            });
        } catch (err) {
            if (result! && result.id) {
                await this.auth.removeOrganizationRole(result.id, userId, "member");
            }

            throw err;
        }
        try {
            const invite = await this.teamDB.resetGenericInvite(result.id);
            this.analytics.track({
                userId,
                event: "team_created",
                properties: {
                    id: result.id,
                    name: result.name,
                    created_at: result.creationTime,
                    invite_id: invite.id,
                },
            });
        } catch (error) {
            log.error("Failed to track team_created event.", error);
        }
        return result;
    }

    public async deleteOrganization(userId: string, orgId: string): Promise<void> {
        await this.auth.checkPermissionOnOrganization(userId, "delete", orgId);
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

                await this.auth.removeAllRelationships(userId, "organization", orgId);
            });
            return this.analytics.track({
                userId: userId,
                event: "team_deleted",
                properties: {
                    team_id: orgId,
                },
            });
        } catch (err) {
            await this.auth.addOrganization(
                userId,
                orgId,
                members,
                projects.map((p) => p.id),
            );
        }
    }

    public async listMembers(userId: string, orgId: string): Promise<OrgMemberInfo[]> {
        await this.auth.checkPermissionOnOrganization(userId, "read_members", orgId);
        const members = await this.teamDB.findMembersByTeam(orgId);

        // TODO(at) remove this workaround once email addresses are persisted under `User.emails`.
        // For now we're avoiding adding `getPrimaryEmail` as dependency to `gitpod-db` module.
        for (const member of members) {
            const user = await this.userDB.findUserById(member.userId);
            if (user) {
                member.primaryEmail = getPrimaryEmail(user);
            }
        }
        return members;
    }

    public async getOrCreateInvite(userId: string, orgId: string): Promise<TeamMembershipInvite> {
        await this.auth.checkPermissionOnOrganization(userId, "invite_members", orgId);
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
        await this.auth.checkPermissionOnOrganization(userId, "invite_members", orgId);
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
        // set skipRoleUpdate=true to avoid member/owner click join link again cause role change
        await runWithSubjectId(SYSTEM_USER, () =>
            this.addOrUpdateMember(SYSTEM_USER_ID, invite.teamId, userId, invite.role, {
                flexibleRole: true,
                skipRoleUpdate: true,
            }),
        );
        this.analytics.track({
            userId: userId,
            event: "team_joined",
            properties: {
                team_id: invite.teamId,
                invite_id: inviteId,
            },
        });

        return invite.teamId;
    }

    /**
     * Add or update member to an organization, if there's no `owner` in the organization, target role will be owner
     *
     * @param opts.flexibleRole when target role is not owner, target role is flexible. Is affected by:
     *     - `dataops` feature
     * @param opts.notUpdate don't update role
     */
    public async addOrUpdateMember(
        userId: string,
        orgId: string,
        memberId: string,
        role: OrgMemberRole,
        opts?: { flexibleRole?: boolean; skipRoleUpdate?: true },
        txCtx?: TransactionalContext,
    ): Promise<void> {
        await this.auth.checkPermissionOnOrganization(userId, "write_members", orgId);
        let members: OrgMemberInfo[] = [];
        try {
            await this.teamDB.transaction(txCtx, async (teamDB, txCtx) => {
                members = await teamDB.findMembersByTeam(orgId);
                const hasOtherRegularOwners =
                    members.filter(
                        (m) =>
                            m.userId !== BUILTIN_INSTLLATION_ADMIN_USER_ID && //
                            m.userId !== memberId && //
                            m.role === "owner",
                    ).length > 0;
                if (!hasOtherRegularOwners) {
                    // first regular member is going to be an owner
                    role = "owner";
                    log.info({ userId: memberId }, "First member of organization, setting role to owner.");
                }

                const result = await teamDB.addMemberToTeam(memberId, orgId);
                if (result === "already_member" && opts?.skipRoleUpdate) {
                    return;
                }

                if (role !== "owner" && opts?.flexibleRole) {
                    const isDataOps = await getExperimentsClientForBackend().getValueAsync("dataops", false, {
                        teamId: orgId,
                    });
                    if (isDataOps) {
                        role = "collaborator";
                    }
                }
                await teamDB.setTeamMemberRole(memberId, orgId, role);
                await this.auth.addOrganizationRole(orgId, memberId, role);
                // we can remove the built-in installation admin if we have added an owner
                if (!hasOtherRegularOwners && members.some((m) => m.userId === BUILTIN_INSTLLATION_ADMIN_USER_ID)) {
                    try {
                        await this.removeOrganizationMember(memberId, orgId, BUILTIN_INSTLLATION_ADMIN_USER_ID, txCtx);
                    } catch (error) {
                        log.warn("Failed to remove built-in installation admin from organization.", error);
                    }
                }
            });
        } catch (err) {
            // remove target role and add old role back
            await this.auth.removeOrganizationRole(orgId, memberId, role);
            const oldRole = members.find((m) => m.userId === memberId)?.role;
            if (oldRole) {
                await this.auth.addOrganizationRole(orgId, memberId, oldRole);
            }
            throw err;
        }
    }

    public async removeOrganizationMember(
        userId: string,
        orgId: string,
        memberId: string,
        txCtx?: TransactionalContext,
    ): Promise<void> {
        // The user is leaving a team, if they are removing themselves from the team.
        if (userId === memberId) {
            await this.auth.checkPermissionOnOrganization(userId, "read_info", orgId);
        } else {
            await this.auth.checkPermissionOnOrganization(userId, "write_members", orgId);
        }
        let membership: OrgMemberInfo | undefined;
        try {
            await this.teamDB.transaction(txCtx, async (db) => {
                // Check for existing membership.
                const members = await db.findMembersByTeam(orgId);
                // cannot remove last owner
                if (!members.some((m) => m.userId !== memberId && m.role === "owner")) {
                    throw new ApplicationError(ErrorCodes.CONFLICT, "Cannot remove the last owner of an organization.");
                }

                membership = members.find((m) => m.userId === memberId);
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
                    await this.userService.deleteUser(userId, memberId);
                }
                await db.removeMemberFromTeam(userToBeRemoved.id, orgId);
                await this.auth.removeOrganizationRole(orgId, memberId, membership.role);
            });
        } catch (err) {
            if (membership) {
                // Rollback to the original role the user had
                await this.auth.addOrganizationRole(orgId, memberId, membership.role);
            }
            const code = ApplicationError.hasErrorCode(err) ? err.code : ErrorCodes.INTERNAL_SERVER_ERROR;
            const message = ApplicationError.hasErrorCode(err) ? err.message : "" + err;
            throw new ApplicationError(code, message);
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
        await this.auth.checkPermissionOnOrganization(userId, "read_settings", orgId);
        const settings = await this.teamDB.findOrgSettings(orgId);
        return this.toSettings(settings);
    }

    async updateSettings(
        userId: string,
        orgId: string,
        settings: Partial<OrganizationSettings>,
    ): Promise<OrganizationSettings> {
        await this.auth.checkPermissionOnOrganization(userId, "write_settings", orgId);
        if (typeof settings.defaultWorkspaceImage === "string") {
            const defaultWorkspaceImage = settings.defaultWorkspaceImage.trim();
            if (defaultWorkspaceImage) {
                await this.validateDefaultWorkspaceImage(userId, defaultWorkspaceImage);
                settings = { ...settings, defaultWorkspaceImage };
            } else {
                settings = { ...settings, defaultWorkspaceImage: null };
            }
        }
        if (settings.allowedWorkspaceClasses) {
            if (settings.allowedWorkspaceClasses.length === 0) {
                // Pass an empty array to allow all workspace classes
                settings.allowedWorkspaceClasses = null;
            } else {
                const allClasses = await this.installationService.getInstallationWorkspaceClasses(userId);
                const availableClasses = allClasses.filter((e) => settings.allowedWorkspaceClasses!.includes(e.id));
                if (availableClasses.length !== settings.allowedWorkspaceClasses.length) {
                    throw new ApplicationError(
                        ErrorCodes.BAD_REQUEST,
                        `items in allowedWorkspaceClasses are not all allowed`,
                    );
                }
                if (availableClasses.length === 0) {
                    throw new ApplicationError(
                        ErrorCodes.BAD_REQUEST,
                        "at least one workspace class has to be selected.",
                    );
                }
            }
        }
        if (settings.pinnedEditorVersions) {
            const ideConfig = await this.ideService.getIDEConfig({ user: { id: userId } });
            for (const [key, version] of Object.entries(settings.pinnedEditorVersions)) {
                if (
                    !ideConfig.ideOptions.options[key] ||
                    !ideConfig.ideOptions.options[key].versions?.find((v) => v.version === version)
                ) {
                    throw new ApplicationError(ErrorCodes.BAD_REQUEST, "invalid ide or ide version.");
                }
            }
        }

        if (settings.restrictedEditorNames) {
            if (settings.restrictedEditorNames.length > 0) {
                await this.ideService.checkEditorsAllowed(userId, settings.restrictedEditorNames);
            }
        }
        return this.toSettings(await this.teamDB.setOrgSettings(orgId, settings));
    }

    private async toSettings(settings: OrganizationSettings = {}): Promise<OrganizationSettings> {
        const result: OrganizationSettings = {};
        if (settings.workspaceSharingDisabled) {
            result.workspaceSharingDisabled = settings.workspaceSharingDisabled;
        }
        if (typeof settings.defaultWorkspaceImage === "string") {
            result.defaultWorkspaceImage = settings.defaultWorkspaceImage;
        }
        if (settings.allowedWorkspaceClasses) {
            result.allowedWorkspaceClasses = settings.allowedWorkspaceClasses;
        }
        if (settings.pinnedEditorVersions) {
            result.pinnedEditorVersions = settings.pinnedEditorVersions;
        }
        if (settings.restrictedEditorNames) {
            result.restrictedEditorNames = settings.restrictedEditorNames;
        }
        return result;
    }

    public async listWorkspaceClasses(userId: string, orgId: string): Promise<SupportedWorkspaceClass[]> {
        const allClasses = await this.installationService.getInstallationWorkspaceClasses(userId);
        const settings = await this.getSettings(userId, orgId);
        if (settings && !!settings.allowedWorkspaceClasses && settings.allowedWorkspaceClasses.length > 0) {
            const availableClasses = allClasses.filter((e) => settings.allowedWorkspaceClasses!.includes(e.id));
            const defaultIndexInScope = availableClasses.findIndex((e) => e.isDefault);
            if (defaultIndexInScope !== -1) {
                return availableClasses;
            }
            const defaultIndexInAll = allClasses.findIndex((e) => e.isDefault);
            const sortedClasses = [
                ...allClasses.slice(0, defaultIndexInAll).reverse(),
                ...allClasses.slice(defaultIndexInAll, allClasses.length),
            ];
            const nextDefault = sortedClasses.find((e) => settings.allowedWorkspaceClasses!.includes(e.id));
            if (nextDefault) {
                nextDefault.isDefault = true;
            }
            return availableClasses;
        }
        return allClasses;
    }
}

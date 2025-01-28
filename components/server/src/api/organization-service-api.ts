/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { inject, injectable } from "inversify";
import { OrganizationService as OrganizationServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/organization_connect";
import {
    CreateOrganizationRequest,
    CreateOrganizationResponse,
    DeleteOrganizationMemberRequest,
    DeleteOrganizationMemberResponse,
    DeleteOrganizationRequest,
    DeleteOrganizationResponse,
    GetOrganizationInvitationRequest,
    GetOrganizationInvitationResponse,
    GetOrganizationRequest,
    GetOrganizationResponse,
    JoinOrganizationRequest,
    JoinOrganizationResponse,
    ListOrganizationMembersRequest,
    ListOrganizationMembersResponse,
    ListOrganizationsRequest,
    ListOrganizationsResponse,
    ResetOrganizationInvitationRequest,
    ResetOrganizationInvitationResponse,
    UpdateOrganizationRequest,
    UpdateOrganizationResponse,
    UpdateOrganizationMemberRequest,
    UpdateOrganizationMemberResponse,
    GetOrganizationSettingsRequest,
    GetOrganizationSettingsResponse,
    UpdateOrganizationSettingsRequest,
    UpdateOrganizationSettingsResponse,
    ListOrganizationsRequest_Scope,
    ListOrganizationWorkspaceClassesRequest,
    ListOrganizationWorkspaceClassesResponse,
} from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { OrganizationService } from "../orgs/organization-service";
import { OrganizationSettings as ProtocolOrganizationSettings } from "@gitpod/gitpod-protocol";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { validate as uuidValidate } from "uuid";
import { ctxUserId } from "../util/request-context";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { EntitlementService } from "../billing/entitlement-service";
import { Config } from "../config";
import { ProjectsService } from "../projects/projects-service";

@injectable()
export class OrganizationServiceAPI implements ServiceImpl<typeof OrganizationServiceInterface> {
    constructor(
        @inject(Config)
        private readonly config: Config,
        @inject(OrganizationService)
        private readonly orgService: OrganizationService,
        @inject(PublicAPIConverter)
        private readonly apiConverter: PublicAPIConverter,
        @inject(EntitlementService)
        private readonly entitlementService: EntitlementService,
        @inject(ProjectsService)
        private readonly projectService: ProjectsService,
    ) {}

    async listOrganizationWorkspaceClasses(
        req: ListOrganizationWorkspaceClassesRequest,
        _: HandlerContext,
    ): Promise<ListOrganizationWorkspaceClassesResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        const list = await this.orgService.listWorkspaceClasses(ctxUserId(), req.organizationId);
        return new ListOrganizationWorkspaceClassesResponse({
            workspaceClasses: list.map((e) => this.apiConverter.toWorkspaceClass(e)),
        });
    }

    async createOrganization(req: CreateOrganizationRequest, _: HandlerContext): Promise<CreateOrganizationResponse> {
        // TODO(gpl) This mimicks the current behavior of adding the subjectId as owner
        const ownerId = ctxUserId();
        if (!ownerId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "No userId available");
        }
        const org = await this.orgService.createOrganization(ownerId, req.name);
        const response = new CreateOrganizationResponse();
        response.organization = this.apiConverter.toOrganization(org);
        return response;
    }

    async getOrganization(req: GetOrganizationRequest, _: HandlerContext): Promise<GetOrganizationResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const org = await this.orgService.getOrganization(ctxUserId(), req.organizationId);
        const response = new GetOrganizationResponse();
        response.organization = this.apiConverter.toOrganization(org);
        return response;
    }

    async updateOrganization(req: UpdateOrganizationRequest, _: HandlerContext): Promise<UpdateOrganizationResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (typeof req.name !== "string") {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "nothing to update");
        }

        const org = await this.orgService.updateOrganization(ctxUserId(), req.organizationId, {
            name: req.name,
        });
        return new UpdateOrganizationResponse({
            organization: this.apiConverter.toOrganization(org),
        });
    }

    async listOrganizations(req: ListOrganizationsRequest, _: HandlerContext): Promise<ListOrganizationsResponse> {
        const orgs = await this.orgService.listOrganizations(
            ctxUserId(),
            {
                limit: req.pagination?.pageSize || 100,
                offset: (req.pagination?.page || 0) * (req.pagination?.pageSize || 0),
            },
            req.scope === ListOrganizationsRequest_Scope.ALL ? "installation" : "member",
        );
        const response = new ListOrganizationsResponse();
        response.organizations = orgs.rows.map((org) => this.apiConverter.toOrganization(org));
        response.pagination = new PaginationResponse();
        response.pagination.total = orgs.total;
        return response;
    }

    async deleteOrganization(req: DeleteOrganizationRequest, _: HandlerContext): Promise<DeleteOrganizationResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        await this.orgService.deleteOrganization(ctxUserId(), req.organizationId);
        return new DeleteOrganizationResponse();
    }

    async getOrganizationInvitation(
        req: GetOrganizationInvitationRequest,
        _: HandlerContext,
    ): Promise<GetOrganizationInvitationResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const invitation = await this.orgService.getOrCreateInvite(ctxUserId(), req.organizationId);
        const response = new GetOrganizationInvitationResponse();
        response.invitationId = invitation.id;
        return response;
    }

    async joinOrganization(req: JoinOrganizationRequest, _: HandlerContext): Promise<JoinOrganizationResponse> {
        if (!uuidValidate(req.invitationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "invitationId is required");
        }

        const orgId = await this.orgService.joinOrganization(ctxUserId(), req.invitationId);
        const result = new JoinOrganizationResponse();
        result.organizationId = orgId;
        return result;
    }

    async resetOrganizationInvitation(
        req: ResetOrganizationInvitationRequest,
        _: HandlerContext,
    ): Promise<ResetOrganizationInvitationResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const inviteId = await this.orgService.resetInvite(ctxUserId(), req.organizationId);
        const result = new ResetOrganizationInvitationResponse();
        result.invitationId = inviteId.id;
        return result;
    }

    async listOrganizationMembers(
        req: ListOrganizationMembersRequest,
        _: HandlerContext,
    ): Promise<ListOrganizationMembersResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const members = await this.orgService.listMembers(ctxUserId(), req.organizationId);
        //TODO pagination
        const response = new ListOrganizationMembersResponse();
        response.members = members.map((member) => this.apiConverter.toOrganizationMember(member));
        response.pagination = new PaginationResponse();
        response.pagination.total = members.length;
        return response;
    }

    async updateOrganizationMember(
        req: UpdateOrganizationMemberRequest,
        _: HandlerContext,
    ): Promise<UpdateOrganizationMemberResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (!uuidValidate(req.userId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }
        if (req.role === undefined) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "nothing to update");
        }

        await this.orgService.addOrUpdateMember(
            ctxUserId(),
            req.organizationId,
            req.userId,
            this.apiConverter.fromOrgMemberRole(req.role),
        );
        const member = await this.orgService
            .listMembers(ctxUserId(), req.organizationId)
            .then((members) => members.find((member) => member.userId === req.userId));
        return new UpdateOrganizationMemberResponse({
            member: member && this.apiConverter.toOrganizationMember(member),
        });
    }

    async deleteOrganizationMember(
        req: DeleteOrganizationMemberRequest,
        _: HandlerContext,
    ): Promise<DeleteOrganizationMemberResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (!uuidValidate(req.userId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }

        await this.orgService.removeOrganizationMember(ctxUserId(), req.organizationId, req.userId);
        return new DeleteOrganizationMemberResponse();
    }

    async getOrganizationSettings(
        req: GetOrganizationSettingsRequest,
        _: HandlerContext,
    ): Promise<GetOrganizationSettingsResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const settings = await this.orgService.getSettings(ctxUserId(), req.organizationId);
        const response = new GetOrganizationSettingsResponse();
        response.settings = this.apiConverter.toOrganizationSettings(settings);
        return response;
    }

    async updateOrganizationSettings(
        req: UpdateOrganizationSettingsRequest,
        _: HandlerContext,
    ): Promise<UpdateOrganizationSettingsResponse> {
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const update: Partial<ProtocolOrganizationSettings> = {};
        if (req.updateRestrictedEditorNames) {
            update.restrictedEditorNames = req.restrictedEditorNames;
        } else if (req.restrictedEditorNames.length > 0) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "updateRestrictedEditorNames is required to be true to update restrictedEditorNames",
            );
        }
        if (typeof req.workspaceSharingDisabled === "boolean") {
            update.workspaceSharingDisabled = req.workspaceSharingDisabled;
        }
        if (typeof req.defaultWorkspaceImage === "string") {
            update.defaultWorkspaceImage = req.defaultWorkspaceImage;
        }
        update.allowedWorkspaceClasses = req.allowedWorkspaceClasses;
        if (req.updatePinnedEditorVersions) {
            update.pinnedEditorVersions = req.pinnedEditorVersions;
        }
        if (typeof req.defaultRole === "string" && req.defaultRole !== "") {
            switch (req.defaultRole) {
                case "owner":
                case "member":
                case "collaborator":
                    update.defaultRole = req.defaultRole;
                    break;
                default:
                    throw new ApplicationError(ErrorCodes.BAD_REQUEST, "invalid defaultRole");
            }
        }

        if (typeof req.timeoutSettings?.denyUserTimeouts === "boolean") {
            update.timeoutSettings = update.timeoutSettings || {};
            update.timeoutSettings.denyUserTimeouts = req.timeoutSettings.denyUserTimeouts;
        }
        if (typeof req.timeoutSettings?.inactivity === "object") {
            update.timeoutSettings = update.timeoutSettings || {};
            update.timeoutSettings.inactivity = this.apiConverter.toDurationString(req.timeoutSettings.inactivity);
        }

        if (req.roleRestrictions.length > 0 && !req.updateRoleRestrictions) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "updateRoleRestrictions is required to be true when updating roleRestrictions",
            );
        }
        if (req.updateRoleRestrictions) {
            update.roleRestrictions = update.roleRestrictions ?? {};
            for (const roleRestriction of req.roleRestrictions) {
                const role = this.apiConverter.fromOrgMemberRole(roleRestriction.role);
                const permissions = roleRestriction.permissions.map((p) =>
                    this.apiConverter.fromOrganizationPermission(p),
                );
                update.roleRestrictions[role] = permissions;
            }
        }

        if (typeof req.maxParallelRunningWorkspaces === "number") {
            if (req.maxParallelRunningWorkspaces < 0) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "maxParallelRunningWorkspaces must be >= 0");
            }
            const maxAllowance = await this.entitlementService.getMaxParallelWorkspaces(
                ctxUserId(),
                req.organizationId,
            );
            if (maxAllowance && req.maxParallelRunningWorkspaces > maxAllowance) {
                throw new ApplicationError(
                    ErrorCodes.BAD_REQUEST,
                    `maxParallelRunningWorkspaces must be <= ${maxAllowance}`,
                );
            }
            if (!Number.isInteger(req.maxParallelRunningWorkspaces)) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "maxParallelRunningWorkspaces must be an integer");
            }

            update.maxParallelRunningWorkspaces = req.maxParallelRunningWorkspaces;
        }

        if (req.onboardingSettings && Object.keys(req.onboardingSettings).length > 0) {
            if (!this.config.isDedicatedInstallation) {
                throw new ApplicationError(
                    ErrorCodes.BAD_REQUEST,
                    "onboardingSettings can only be set on enterprise installations",
                );
            }
            if ((req.onboardingSettings.internalLink?.length ?? 0) > 255) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "internalLink must be <= 255 characters");
            }

            if (req.onboardingSettings.recommendedRepositories) {
                if (req.onboardingSettings.recommendedRepositories.length > 3) {
                    throw new ApplicationError(
                        ErrorCodes.BAD_REQUEST,
                        "there can't be more than 3 recommendedRepositories",
                    );
                }
                for (const configurationId of req.onboardingSettings.recommendedRepositories) {
                    if (!uuidValidate(configurationId)) {
                        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "recommendedRepositories must be UUIDs");
                    }

                    const project = await this.projectService.getProject(ctxUserId(), configurationId);
                    if (!project) {
                        throw new ApplicationError(ErrorCodes.BAD_REQUEST, `repository ${configurationId} not found`);
                    }
                }
            }

            update.onboardingSettings = req.onboardingSettings;
        }
        if (req.annotateGitCommits !== undefined) {
            update.annotateGitCommits = req.annotateGitCommits;
        }

        if (Object.keys(update).length === 0) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "nothing to update");
        }

        const settings = await this.orgService.updateSettings(ctxUserId(), req.organizationId, update);
        return new UpdateOrganizationSettingsResponse({
            settings: this.apiConverter.toOrganizationSettings(settings),
        });
    }
}

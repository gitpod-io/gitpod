/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { inject, injectable } from "inversify";
import { OrganizationService as OrganizationServiceInterface } from "@gitpod/public-api/lib/gitpod/experimental/v2/organization_connect";
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
} from "@gitpod/public-api/lib/gitpod/experimental/v2/organization_pb";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { OrganizationService } from "../orgs/organization-service";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/experimental/v2/pagination_pb";
import { ctx } from "../util/request-context";

@injectable()
export class OrganizationServiceAPI implements ServiceImpl<typeof OrganizationServiceInterface> {
    constructor(
        @inject(OrganizationService)
        private readonly orgService: OrganizationService,
        @inject(PublicAPIConverter)
        private readonly apiConverter: PublicAPIConverter,
    ) {}

    async createOrganization(req: CreateOrganizationRequest, _: HandlerContext): Promise<CreateOrganizationResponse> {
        const ownerId = req.ownerId || ctx().subjectId?.userId();
        const org = await this.orgService.createOrganization(undefined, ownerId, req.name);
        const response = new CreateOrganizationResponse();
        response.organization = this.apiConverter.toOrganization(org);
        return response;
    }

    async getOrganization(req: GetOrganizationRequest, _: HandlerContext): Promise<GetOrganizationResponse> {
        const org = await this.orgService.getOrganization(undefined, req.organizationId);
        const response = new GetOrganizationResponse();
        response.organization = this.apiConverter.toOrganization(org);
        return response;
    }

    async updateOrganization(req: UpdateOrganizationRequest, _: HandlerContext): Promise<UpdateOrganizationResponse> {
        await this.orgService.updateOrganization(undefined, req.organizationId, {
            name: req.name,
        });
        return new UpdateOrganizationResponse();
    }

    async listOrganizations(req: ListOrganizationsRequest, _: HandlerContext): Promise<ListOrganizationsResponse> {
        const orgs = await this.orgService.listOrganizations(undefined, {
            limit: req.pagination?.pageSize || 100,
            offset: (req.pagination?.page || 0) * (req.pagination?.pageSize || 0),
        });
        const response = new ListOrganizationsResponse();
        response.organizations = orgs.rows.map((org) => this.apiConverter.toOrganization(org));
        response.pagination = new PaginationResponse();
        response.pagination.total = orgs.total;
        return response;
    }

    async deleteOrganization(req: DeleteOrganizationRequest, _: HandlerContext): Promise<DeleteOrganizationResponse> {
        await this.orgService.deleteOrganization(undefined, req.organizationId);
        return new DeleteOrganizationResponse();
    }

    async getOrganizationInvitation(
        req: GetOrganizationInvitationRequest,
        _: HandlerContext,
    ): Promise<GetOrganizationInvitationResponse> {
        const invitation = await this.orgService.getOrCreateInvite(undefined, req.organizationId);
        const response = new GetOrganizationInvitationResponse();
        response.invitationId = invitation.id;
        return response;
    }

    async joinOrganization(req: JoinOrganizationRequest, _: HandlerContext): Promise<JoinOrganizationResponse> {
        const orgId = await this.orgService.joinOrganization(req.joineeId, req.invitationId);
        const result = new JoinOrganizationResponse();
        result.organizationId = orgId;
        return result;
    }

    async resetOrganizationInvitation(
        req: ResetOrganizationInvitationRequest,
        _: HandlerContext,
    ): Promise<ResetOrganizationInvitationResponse> {
        const inviteId = await this.orgService.resetInvite(undefined, req.organizationId);
        const result = new ResetOrganizationInvitationResponse();
        result.invitationId = inviteId.id;
        return result;
    }

    async listOrganizationMembers(
        req: ListOrganizationMembersRequest,
        _: HandlerContext,
    ): Promise<ListOrganizationMembersResponse> {
        const members = await this.orgService.listMembers(undefined, req.organizationId);
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
        await this.orgService.addOrUpdateMember(
            undefined,
            req.organizationId,
            req.userId,
            this.apiConverter.fromOrgMemberRole(req.role),
        );
        return new UpdateOrganizationMemberResponse();
    }

    async deleteOrganizationMember(
        req: DeleteOrganizationMemberRequest,
        _: HandlerContext,
    ): Promise<DeleteOrganizationMemberResponse> {
        await this.orgService.removeOrganizationMember(undefined, req.organizationId, req.userId);
        return new DeleteOrganizationMemberResponse();
    }

    async getOrganizationSettings(
        req: GetOrganizationSettingsRequest,
        _: HandlerContext,
    ): Promise<GetOrganizationSettingsResponse> {
        const settings = await this.orgService.getSettings(undefined, req.organizationId);
        const response = new GetOrganizationSettingsResponse();
        response.settings = this.apiConverter.toOrganizationSettings(settings);
        return response;
    }

    async updateOrganizationSettings(
        req: UpdateOrganizationSettingsRequest,
        _: HandlerContext,
    ): Promise<UpdateOrganizationSettingsResponse> {
        await this.orgService.updateSettings(undefined, req.organizationId, {
            workspaceSharingDisabled: req.settings?.workspaceSharingDisabled,
            defaultWorkspaceImage: req.settings?.defaultWorkspaceImage,
        });
        return new UpdateOrganizationSettingsResponse();
    }
}

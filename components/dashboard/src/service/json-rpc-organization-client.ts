/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialMessage } from "@bufbuild/protobuf";
import { CallOptions, Code, ConnectError, PromiseClient } from "@connectrpc/connect";
import { OrganizationService } from "@gitpod/public-api/lib/gitpod/v1/organization_connect";
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
    GetOrganizationSettingsRequest,
    GetOrganizationSettingsResponse,
    JoinOrganizationRequest,
    JoinOrganizationResponse,
    ListOrganizationMembersRequest,
    ListOrganizationMembersResponse,
    ListOrganizationsRequest,
    ListOrganizationsResponse,
    ResetOrganizationInvitationRequest,
    ResetOrganizationInvitationResponse,
    UpdateOrganizationMemberRequest,
    UpdateOrganizationMemberResponse,
    UpdateOrganizationRequest,
    UpdateOrganizationResponse,
    UpdateOrganizationSettingsRequest,
    UpdateOrganizationSettingsResponse,
} from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { getGitpodService } from "./service";
import { converter } from "./public-api";
import { OrganizationSettings } from "@gitpod/gitpod-protocol";

export class JsonRpcOrganizationClient implements PromiseClient<typeof OrganizationService> {
    async createOrganization(
        request: PartialMessage<CreateOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<CreateOrganizationResponse> {
        if (!request.name) {
            throw new ConnectError("name is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.createTeam(request.name);
        return new CreateOrganizationResponse({
            organization: converter.toOrganization(result),
        });
    }

    async getOrganization(
        request: PartialMessage<GetOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<GetOrganizationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.getTeam(request.organizationId);

        return new GetOrganizationResponse({
            organization: converter.toOrganization(result),
        });
    }

    async updateOrganization(
        request: PartialMessage<UpdateOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<UpdateOrganizationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        if (!request.name) {
            throw new ConnectError("name is required", Code.InvalidArgument);
        }
        await getGitpodService().server.updateTeam(request.organizationId, {
            name: request.name,
        });
        return new UpdateOrganizationResponse();
    }

    async listOrganizations(
        request: PartialMessage<ListOrganizationsRequest>,
        options?: CallOptions | undefined,
    ): Promise<ListOrganizationsResponse> {
        const result = await getGitpodService().server.getTeams();
        return new ListOrganizationsResponse({
            organizations: result.map((team) => converter.toOrganization(team)),
        });
    }

    async deleteOrganization(
        request: PartialMessage<DeleteOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<DeleteOrganizationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        await getGitpodService().server.deleteTeam(request.organizationId);
        return new DeleteOrganizationResponse();
    }

    async getOrganizationInvitation(
        request: PartialMessage<GetOrganizationInvitationRequest>,
        options?: CallOptions | undefined,
    ): Promise<GetOrganizationInvitationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.getGenericInvite(request.organizationId);
        return new GetOrganizationInvitationResponse({
            invitationId: result.id,
        });
    }

    async joinOrganization(
        request: PartialMessage<JoinOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<JoinOrganizationResponse> {
        if (!request.invitationId) {
            throw new ConnectError("invitationId is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.joinTeam(request.invitationId);
        return new JoinOrganizationResponse({
            organizationId: result.id,
        });
    }

    async resetOrganizationInvitation(
        request: PartialMessage<ResetOrganizationInvitationRequest>,
        options?: CallOptions | undefined,
    ): Promise<ResetOrganizationInvitationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        const newInvite = await getGitpodService().server.resetGenericInvite(request.organizationId);
        return new ResetOrganizationInvitationResponse({
            invitationId: newInvite.id,
        });
    }

    async listOrganizationMembers(
        request: PartialMessage<ListOrganizationMembersRequest>,
        options?: CallOptions | undefined,
    ): Promise<ListOrganizationMembersResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.getTeamMembers(request.organizationId);
        return new ListOrganizationMembersResponse({
            members: result.map((member) => converter.toOrganizationMember(member)),
        });
    }

    async updateOrganizationMember(
        request: PartialMessage<UpdateOrganizationMemberRequest>,
        options?: CallOptions | undefined,
    ): Promise<UpdateOrganizationMemberResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        if (!request.userId) {
            throw new ConnectError("userId is required", Code.InvalidArgument);
        }
        if (!request.role) {
            throw new ConnectError("role is required", Code.InvalidArgument);
        }
        await getGitpodService().server.setTeamMemberRole(
            request.organizationId,
            request.userId,
            converter.fromOrgMemberRole(request.role),
        );
        return new UpdateOrganizationMemberResponse();
    }

    async deleteOrganizationMember(
        request: PartialMessage<DeleteOrganizationMemberRequest>,
        options?: CallOptions | undefined,
    ): Promise<DeleteOrganizationMemberResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        if (!request.userId) {
            throw new ConnectError("userId is required", Code.InvalidArgument);
        }
        await getGitpodService().server.removeTeamMember(request.organizationId, request.userId);
        return new DeleteOrganizationMemberResponse();
    }

    async getOrganizationSettings(
        request: PartialMessage<GetOrganizationSettingsRequest>,
        options?: CallOptions | undefined,
    ): Promise<GetOrganizationSettingsResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.getOrgSettings(request.organizationId);
        return new GetOrganizationSettingsResponse({
            settings: converter.toOrganizationSettings(result),
        });
    }

    async updateOrganizationSettings(
        request: PartialMessage<UpdateOrganizationSettingsRequest>,
        options?: CallOptions | undefined,
    ): Promise<UpdateOrganizationSettingsResponse> {
        if (!request.organizationId) {
            throw new ConnectError("organizationId is required", Code.InvalidArgument);
        }
        const update: Partial<OrganizationSettings> = {
            workspaceSharingDisabled: request?.workspaceSharingDisabled,
        };
        const resetDefaultWorkspaceImage = request.resetMask?.paths?.includes("default_workspace_image");
        if (resetDefaultWorkspaceImage) {
            update.defaultWorkspaceImage = null;
        } else if (typeof request?.defaultWorkspaceImage === "string") {
            update.defaultWorkspaceImage = request.defaultWorkspaceImage;
        }
        await getGitpodService().server.updateOrgSettings(request.organizationId, update);
        return new UpdateOrganizationSettingsResponse();
    }
}

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialMessage } from "@bufbuild/protobuf";
import { CallOptions, Code, ConnectError, PromiseClient } from "@connectrpc/connect";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { OrganizationService } from "@gitpod/public-api/lib/gitpod/experimental/v2/organization_connect";
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
} from "@gitpod/public-api/lib/gitpod/experimental/v2/organization_pb";
import { getGitpodService } from "./service";

export class JsonRpcOrganizationClient implements PromiseClient<typeof OrganizationService> {
    // createOrganization: (request: PartialMessage<CreateOrganizationRequest>, options?: CallOptions | undefined) => Promise<...>;
    // getOrganization: (request: PartialMessage<GetOrganizationRequest>, options?: CallOptions | undefined) => Promise<...>;
    // updateOrganization: (request: PartialMessage<UpdateOrganizationRequest>, options?: CallOptions | undefined) => Promise<...>;
    // listOrganizations: (request: PartialMessage<ListOrganizationsRequest>, options?: CallOptions | undefined) => Promise<...>;
    // deleteOrganization: (request: PartialMessage<DeleteOrganizationRequest>, options?: CallOptions | undefined) => Promise<...>;
    // getOrganizationInvitation: (request: PartialMessage<GetOrganizationInvitationRequest>, options?: CallOptions | undefined) => Promise<...>;
    // joinOrganization: (request: PartialMessage<JoinOrganizationRequest>, options?: CallOptions | undefined) => Promise<...>;
    // resetOrganizationInvitation: (request: PartialMessage<ResetOrganizationInvitationRequest>, options?: CallOptions | undefined) => Promise<...>;
    // listOrganizationMembers: (request: PartialMessage<ListOrganizationMembersRequest>, options?: CallOptions | undefined) => Promise<...>;
    // updateOrganizationMember: (request: PartialMessage<UpdateOrganizationMemberRequest>, options?: CallOptions | undefined) => Promise<...>;
    // deleteOrganizationMember: (request: PartialMessage<DeleteOrganizationMemberRequest>, options?: CallOptions | undefined) => Promise<...>;
    // getOrganizationSettings: (request: PartialMessage<GetOrganizationSettingsRequest>, options?: CallOptions | undefined) => Promise<...>;
    // updateOrganizationSettings: (request: PartialMessage<UpdateOrganizationSettingsRequest>, options?: CallOptions | undefined) => Promise<...>;

    private converter = new PublicAPIConverter();

    async createOrganization(
        request: PartialMessage<CreateOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<CreateOrganizationResponse> {
        if (!request.name) {
            throw new ConnectError("name is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.createTeam(request.name);
        return new CreateOrganizationResponse({
            organization: this.converter.toOrganization(result),
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
            organization: this.converter.toOrganization(result),
        });
    }

    async updateOrganization(
        request: PartialMessage<UpdateOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<UpdateOrganizationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("id is required", Code.InvalidArgument);
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
            organizations: result.map((team) => this.converter.toOrganization(team)),
        });
    }

    async deleteOrganization(
        request: PartialMessage<DeleteOrganizationRequest>,
        options?: CallOptions | undefined,
    ): Promise<DeleteOrganizationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        await getGitpodService().server.deleteTeam(request.organizationId);
        return new DeleteOrganizationResponse();
    }

    async getOrganizationInvitation(
        request: PartialMessage<GetOrganizationInvitationRequest>,
        options?: CallOptions | undefined,
    ): Promise<GetOrganizationInvitationResponse> {
        if (!request.organizationId) {
            throw new ConnectError("id is required", Code.InvalidArgument);
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
            throw new ConnectError("id is required", Code.InvalidArgument);
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
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.getTeamMembers(request.organizationId);
        return new ListOrganizationMembersResponse({
            members: result.map((member) => this.converter.toOrganizationMember(member)),
        });
    }

    async updateOrganizationMember(
        request: PartialMessage<UpdateOrganizationMemberRequest>,
        options?: CallOptions | undefined,
    ): Promise<UpdateOrganizationMemberResponse> {
        if (!request.organizationId) {
            throw new ConnectError("id is required", Code.InvalidArgument);
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
            this.converter.fromOrgMemberRole(request.role),
        );
        return new UpdateOrganizationMemberResponse();
    }

    async deleteOrganizationMember(
        request: PartialMessage<DeleteOrganizationMemberRequest>,
        options?: CallOptions | undefined,
    ): Promise<DeleteOrganizationMemberResponse> {
        if (!request.organizationId) {
            throw new ConnectError("id is required", Code.InvalidArgument);
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
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        const result = await getGitpodService().server.getOrgSettings(request.organizationId);
        return new GetOrganizationSettingsResponse({
            settings: this.converter.toOrganizationSettings(result),
        });
    }

    async updateOrganizationSettings(
        request: PartialMessage<UpdateOrganizationSettingsRequest>,
        options?: CallOptions | undefined,
    ): Promise<UpdateOrganizationSettingsResponse> {
        if (!request.organizationId) {
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        await getGitpodService().server.updateOrgSettings(request.organizationId, {
            workspaceSharingDisabled: request.settings?.workspaceSharingDisabled,
            defaultWorkspaceImage: request.settings?.defaultWorkspaceImage,
        });
        return new UpdateOrganizationSettingsResponse();
    }
}

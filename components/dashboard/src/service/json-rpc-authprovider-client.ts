/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialMessage } from "@bufbuild/protobuf";
import { Code, ConnectError, PromiseClient } from "@connectrpc/connect";
import { AuthProviderService } from "@gitpod/public-api/lib/gitpod/v1/authprovider_connect";
import {
    CreateAuthProviderRequest,
    CreateAuthProviderResponse,
    DeleteAuthProviderRequest,
    DeleteAuthProviderResponse,
    GetAuthProviderRequest,
    GetAuthProviderResponse,
    ListAuthProviderDescriptionsRequest,
    ListAuthProviderDescriptionsResponse,
    ListAuthProvidersRequest,
    ListAuthProvidersResponse,
    UpdateAuthProviderRequest,
    UpdateAuthProviderResponse,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { converter } from "./public-api";
import { getGitpodService } from "./service";

export class JsonRpcAuthProviderClient implements PromiseClient<typeof AuthProviderService> {
    async createAuthProvider(request: PartialMessage<CreateAuthProviderRequest>): Promise<CreateAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async getAuthProvider(request: PartialMessage<GetAuthProviderRequest>): Promise<GetAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ConnectError("authProviderId is required", Code.InvalidArgument);
        }
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async listAuthProviders(request: PartialMessage<ListAuthProvidersRequest>): Promise<ListAuthProvidersResponse> {
        if (!request.id?.case) {
            throw new ConnectError("id is required", Code.InvalidArgument);
        }
        const organizationId = request.id.case === "organizationId" ? request.id.value : undefined;
        const userId = request.id.case === "userId" ? request.id.value : undefined;

        if (!organizationId && !userId) {
            throw new ConnectError("organizationId or userId is required", Code.InvalidArgument);
        }

        const authProviders = !!organizationId
            ? await getGitpodService().server.getOrgAuthProviders({
                  organizationId,
              })
            : await getGitpodService().server.getOwnAuthProviders();
        const response = new ListAuthProvidersResponse({
            authProviders: authProviders.map(converter.toAuthProvider),
        });
        return response;
    }

    async listAuthProviderDescriptions(
        request: PartialMessage<ListAuthProviderDescriptionsRequest>,
    ): Promise<ListAuthProviderDescriptionsResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async updateAuthProvider(request: PartialMessage<UpdateAuthProviderRequest>): Promise<UpdateAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ConnectError("authProviderId is required", Code.InvalidArgument);
        }
        const clientId = request?.oauth2Config?.clientId;
        const clientSecret = request?.oauth2Config?.clientSecret;
        if (!clientId || !clientSecret) {
            throw new ConnectError("clientId or clientSecret are required", Code.InvalidArgument);
        }

        await getGitpodService().server.updateAuthProvider(request.authProviderId, {
            clientId,
            clientSecret,
        });
        return new UpdateAuthProviderResponse();
    }

    async deleteAuthProvider(request: PartialMessage<DeleteAuthProviderRequest>): Promise<DeleteAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ConnectError("authProviderId is required", Code.InvalidArgument);
        }
        await getGitpodService().server.deleteAuthProvider(request.authProviderId);
        return new DeleteAuthProviderResponse();
    }
}

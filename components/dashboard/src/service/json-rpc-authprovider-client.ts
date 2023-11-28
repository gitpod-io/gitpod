/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialMessage } from "@bufbuild/protobuf";
import { PromiseClient } from "@connectrpc/connect";
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
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

export class JsonRpcAuthProviderClient implements PromiseClient<typeof AuthProviderService> {
    async createAuthProvider(request: PartialMessage<CreateAuthProviderRequest>): Promise<CreateAuthProviderResponse> {
        const ownerId = request.owner?.case === "ownerId" ? request.owner.value : undefined;
        const organizationId = request.owner?.case === "organizationId" ? request.owner.value : undefined;

        if (!organizationId && !ownerId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId or ownerId is required");
        }
        if (!request.type) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "type is required");
        }
        if (!request.host) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "host is required");
        }

        if (organizationId) {
            const result = await getGitpodService().server.createOrgAuthProvider({
                entry: {
                    organizationId,
                    host: request.host,
                    type: converter.fromAuthProviderType(request.type),
                    clientId: request.oauth2Config?.clientId,
                    clientSecret: request.oauth2Config?.clientSecret,
                },
            });
            return new CreateAuthProviderResponse({ authProvider: converter.toAuthProvider(result) });
        }
        if (ownerId) {
            const result = await getGitpodService().server.updateOwnAuthProvider({
                entry: {
                    host: request.host,
                    ownerId,
                    type: converter.fromAuthProviderType(request.type),
                    clientId: request.oauth2Config?.clientId,
                    clientSecret: request.oauth2Config?.clientSecret,
                },
            });
            return new CreateAuthProviderResponse({ authProvider: converter.toAuthProvider(result) });
        }

        throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId or ownerId is required");
    }

    async getAuthProvider(request: PartialMessage<GetAuthProviderRequest>): Promise<GetAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "authProviderId is required");
        }

        const provider = await getGitpodService().server.getAuthProvider(request.authProviderId);
        return new GetAuthProviderResponse({
            authProvider: converter.toAuthProvider(provider),
        });
    }

    async listAuthProviders(request: PartialMessage<ListAuthProvidersRequest>): Promise<ListAuthProvidersResponse> {
        if (!request.id?.case) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "id is required");
        }
        const organizationId = request.id.case === "organizationId" ? request.id.value : undefined;
        const userId = request.id.case === "userId" ? request.id.value : undefined;

        if (!organizationId && !userId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId or userId is required");
        }

        const authProviders = organizationId
            ? await getGitpodService().server.getOrgAuthProviders({
                  organizationId,
              })
            : await getGitpodService().server.getOwnAuthProviders();
        const response = new ListAuthProvidersResponse({
            authProviders: authProviders.map(converter.toAuthProvider.bind(converter)),
        });
        return response;
    }

    async listAuthProviderDescriptions(
        request: PartialMessage<ListAuthProviderDescriptionsRequest>,
    ): Promise<ListAuthProviderDescriptionsResponse> {
        const aps = await getGitpodService().server.getAuthProviders();
        return new ListAuthProviderDescriptionsResponse({
            descriptions: aps.map((ap) => converter.toAuthProviderDescription(ap)),
        });
    }

    async updateAuthProvider(request: PartialMessage<UpdateAuthProviderRequest>): Promise<UpdateAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "authProviderId is required");
        }
        const clientId = request?.clientId || "";
        const clientSecret = request?.clientSecret || "";
        if (!clientId && !clientSecret) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "clientId or clientSecret are required");
        }

        const entry = await getGitpodService().server.updateAuthProvider(request.authProviderId, {
            clientId,
            clientSecret,
        });
        return new UpdateAuthProviderResponse({
            authProvider: converter.toAuthProvider(entry),
        });
    }

    async deleteAuthProvider(request: PartialMessage<DeleteAuthProviderRequest>): Promise<DeleteAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "authProviderId is required");
        }
        await getGitpodService().server.deleteAuthProvider(request.authProviderId);
        return new DeleteAuthProviderResponse();
    }
}

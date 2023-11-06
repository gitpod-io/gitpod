/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, PromiseClient } from "@connectrpc/connect";
import { PartialMessage } from "@bufbuild/protobuf";
import { AuthProviderService } from "@gitpod/public-api/lib/gitpod/v1/authprovider_connect";
import {
    CreateAuthProviderRequest,
    GetAuthProviderRequest,
    ListAuthProvidersRequest,
    ListAuthProviderDescriptionsRequest,
    UpdateAuthProviderRequest,
    DeleteAuthProviderRequest,
    CreateAuthProviderResponse,
    ListAuthProvidersResponse,
    GetAuthProviderResponse,
    ListAuthProviderDescriptionsResponse,
    UpdateAuthProviderResponse,
    DeleteAuthProviderResponse,
    AuthProvider,
    AuthProviderType,
    OAuth2Config,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
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

        if (organizationId) {
            const result = await getGitpodService().server.getOrgAuthProviders({
                organizationId,
            });
            const response = new ListAuthProvidersResponse();
            response.list = result.map(toAuthProvider);
            return response;
        }
        if (userId) {
            const result = await getGitpodService().server.getOwnAuthProviders();
            const response = new ListAuthProvidersResponse();
            response.list = result.map(toAuthProvider);
            return response;
        }
        throw new ConnectError("either organizationId or userId are required", Code.InvalidArgument);
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

function toAuthProvider(entry: AuthProviderEntry): AuthProvider {
    const ap = new AuthProvider();
    ap.verified = entry.status === "verified";
    ap.host = entry.host;
    ap.id = entry.id;
    ap.type = toAuthProviderType(entry.type);
    ap.oauth2Config = toOAuth2Config(entry);
    ap.scopes = entry.oauth?.scope?.split(entry.oauth?.scopeSeparator || " ") || [];
    ap.settingsUrl = entry.oauth.settingsUrl;
    return ap;
}

function toOAuth2Config(entry: AuthProviderEntry): OAuth2Config {
    const config = new OAuth2Config();
    config.clientId = entry.oauth.clientId;
    config.clientSecret = entry.oauth.clientSecret;
    return config;
}

function toAuthProviderType(type: string): AuthProviderType {
    switch (type) {
        case "GitHub":
            return AuthProviderType.GITHUB;
        case "GitLab":
            return AuthProviderType.GITLAB;
        case "Bitbucket":
            return AuthProviderType.BITBUCKET;
        case "BitbucketServer":
            return AuthProviderType.BITBUCKET_SERVER;
        default:
            return AuthProviderType.UNSPECIFIED; // not allowed
    }
}

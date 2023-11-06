/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { AuthProviderService as AuthProviderServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/authprovider_connect";
import { inject, injectable } from "inversify";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import {
    CreateAuthProviderRequest,
    CreateAuthProviderResponse,
    GetAuthProviderRequest,
    GetAuthProviderResponse,
    ListAuthProvidersRequest,
    ListAuthProvidersResponse,
    ListAuthProviderDescriptionsRequest,
    ListAuthProviderDescriptionsResponse,
    UpdateAuthProviderRequest,
    UpdateAuthProviderResponse,
    DeleteAuthProviderRequest,
    DeleteAuthProviderResponse,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { AuthProviderService } from "../auth/auth-provider-service";
import { AuthProviderEntry } from "@gitpod/gitpod-protocol";

@injectable()
export class AuthProviderServiceAPI implements ServiceImpl<typeof AuthProviderServiceInterface> {
    constructor(
        @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter,
        @inject(AuthProviderService) private readonly authProviderService: AuthProviderService,
    ) {}

    async createAuthProvider(
        request: CreateAuthProviderRequest,
        context: HandlerContext,
    ): Promise<CreateAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    async getAuthProvider(request: GetAuthProviderRequest, context: HandlerContext): Promise<GetAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ConnectError("authProviderId is required", Code.InvalidArgument);
        }

        const authProvider = await this.authProviderService.getAuthProvider(context.user.id, request.authProviderId);
        if (!authProvider) {
            throw new ConnectError("Provider not found.", Code.NotFound);
        }

        return new GetAuthProviderResponse({
            authProvider: this.apiConverter.toAuthProvider(authProvider),
        });
    }

    async listAuthProviders(
        request: ListAuthProvidersRequest,
        context: HandlerContext,
    ): Promise<ListAuthProvidersResponse> {
        const target = request.id;
        const ownerId = target.case === "userId" ? target.value : undefined;
        const organizationId = target.case === "organizationId" ? target.value : undefined;

        if (!organizationId && !ownerId) {
            throw new ConnectError("organizationId or ownerId is required", Code.InvalidArgument);
        }

        const authProviders = organizationId
            ? await this.authProviderService.getAuthProvidersOfOrg(context.user.id, organizationId)
            : await this.authProviderService.getAuthProvidersOfUser(context.user.id);

        const redacted = authProviders.map(AuthProviderEntry.redact.bind(AuthProviderEntry));

        const result = new ListAuthProvidersResponse({
            list: redacted.map((ap) => this.apiConverter.toAuthProvider(ap)),
        });
        return result;
    }

    async listAuthProviderDescriptions(
        request: ListAuthProviderDescriptionsRequest,
        context: HandlerContext,
    ): Promise<ListAuthProviderDescriptionsResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async updateAuthProvider(
        request: UpdateAuthProviderRequest,
        context: HandlerContext,
    ): Promise<UpdateAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }

    async deleteAuthProvider(
        request: DeleteAuthProviderRequest,
        context: HandlerContext,
    ): Promise<DeleteAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
}

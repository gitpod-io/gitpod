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
import { AuthProviderEntry, AuthProviderInfo } from "@gitpod/gitpod-protocol";
import { Unauthenticated } from "./unauthenticated";
import { validate as uuidValidate } from "uuid";

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
        const ownerId = request.owner.case === "ownerId" ? request.owner.value : "";
        const organizationId = request.owner.case === "organizationId" ? request.owner.value : "";

        if (!uuidValidate(organizationId) && !uuidValidate(ownerId)) {
            throw new ConnectError("organizationId or ownerId is required", Code.InvalidArgument);
        }

        if (organizationId) {
            const result = await this.authProviderService.createOrgAuthProvider(context.user.id, {
                organizationId,
                host: request.host,
                ownerId: context.user.id,
                type: this.apiConverter.fromAuthProviderType(request.type),
                clientId: request.oauth2Config?.clientId,
                clientSecret: request.oauth2Config?.clientSecret,
            });

            return new CreateAuthProviderResponse({ authProvider: this.apiConverter.toAuthProvider(result) });
        } else {
            const result = await this.authProviderService.createAuthProviderOfUser(context.user.id, {
                host: request.host,
                ownerId: context.user.id,
                type: this.apiConverter.fromAuthProviderType(request.type),
                clientId: request.oauth2Config?.clientId,
                clientSecret: request.oauth2Config?.clientSecret,
            });

            return new CreateAuthProviderResponse({ authProvider: this.apiConverter.toAuthProvider(result) });
        }
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
        const ownerId = target.case === "userId" ? target.value : "";
        const organizationId = target.case === "organizationId" ? target.value : "";

        if (!uuidValidate(organizationId) && !uuidValidate(ownerId)) {
            throw new ConnectError("organizationId or ownerId is required", Code.InvalidArgument);
        }

        const authProviders = organizationId
            ? await this.authProviderService.getAuthProvidersOfOrg(context.user.id, organizationId)
            : await this.authProviderService.getAuthProvidersOfUser(context.user.id);

        const redacted = authProviders.map(AuthProviderEntry.redact.bind(AuthProviderEntry));

        const result = new ListAuthProvidersResponse({
            authProviders: redacted.map((ap) => this.apiConverter.toAuthProvider(ap)),
        });
        return result;
    }

    /**
     * Listing descriptions of auth providers doesn't require authentication.
     */
    @Unauthenticated()
    async listAuthProviderDescriptions(
        _request: ListAuthProviderDescriptionsRequest,
        context: HandlerContext,
    ): Promise<ListAuthProviderDescriptionsResponse> {
        const user = context.user;
        const aps = user
            ? await this.authProviderService.getAuthProviderDescriptions(user)
            : await this.authProviderService.getAuthProviderDescriptionsUnauthenticated();

        return new ListAuthProviderDescriptionsResponse({
            descriptions: aps.map((ap: AuthProviderInfo) => this.apiConverter.toAuthProviderDescription(ap)),
        });
    }

    async updateAuthProvider(
        request: UpdateAuthProviderRequest,
        context: HandlerContext,
    ): Promise<UpdateAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ConnectError("authProviderId is required", Code.InvalidArgument);
        }
        const clientId = request.clientId;
        const clientSecret = request.clientSecret;
        if (!clientId || typeof clientSecret === "undefined") {
            throw new ConnectError("clientId or clientSecret are required", Code.InvalidArgument);
        }

        const authProvider = await this.authProviderService.getAuthProvider(context.user.id, request.authProviderId);
        if (!authProvider) {
            throw new ConnectError("Provider not found.", Code.NotFound);
        }

        let entry: AuthProviderEntry;
        if (authProvider.organizationId) {
            entry = await this.authProviderService.updateOrgAuthProvider(context.user.id, {
                id: request.authProviderId,
                organizationId: authProvider.organizationId,
                clientId: clientId,
                clientSecret: clientSecret,
            });
        } else {
            entry = await this.authProviderService.updateAuthProviderOfUser(context.user.id, {
                id: request.authProviderId,
                ownerId: context.user.id,
                clientId: clientId,
                clientSecret: clientSecret,
            });
        }

        return new UpdateAuthProviderResponse({
            authProvider: this.apiConverter.toAuthProvider(AuthProviderEntry.redact(entry)),
        });
    }

    async deleteAuthProvider(
        request: DeleteAuthProviderRequest,
        context: HandlerContext,
    ): Promise<DeleteAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ConnectError("authProviderId is required", Code.InvalidArgument);
        }

        const authProvider = await this.authProviderService.getAuthProvider(context.user.id, request.authProviderId);
        if (!authProvider) {
            throw new ConnectError("Provider not found.", Code.NotFound);
        }

        if (authProvider.organizationId) {
            await this.authProviderService.deleteAuthProviderOfOrg(
                context.user.id,
                authProvider.organizationId,
                request.authProviderId,
            );
        } else {
            await this.authProviderService.deleteAuthProviderOfUser(context.user.id, request.authProviderId);
        }

        return new DeleteAuthProviderResponse();
    }
}

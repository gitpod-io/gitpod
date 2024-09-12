/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { AuthProviderService as AuthProviderServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/authprovider_connect";
import { inject, injectable } from "inversify";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
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
import { AuthProviderEntry, AuthProviderInfo, User } from "@gitpod/gitpod-protocol";
import { Unauthenticated } from "./unauthenticated";
import { validate as uuidValidate } from "uuid";
import { selectPage } from "./pagination";
import { ctxTrySubjectId, ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class AuthProviderServiceAPI implements ServiceImpl<typeof AuthProviderServiceInterface> {
    constructor(
        @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter,
        @inject(AuthProviderService) private readonly authProviderService: AuthProviderService,
        @inject(UserService) private readonly userService: UserService,
    ) {}

    async createAuthProvider(
        request: CreateAuthProviderRequest,
        _: HandlerContext,
    ): Promise<CreateAuthProviderResponse> {
        const organizationId = request.owner.case === "organizationId" ? request.owner.value : "";

        if (organizationId) {
            if (!uuidValidate(organizationId)) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
            }

            const result = await this.authProviderService.createOrgAuthProvider(ctxUserId(), {
                organizationId,
                host: request.host,
                ownerId: ctxUserId(),
                type: this.apiConverter.fromAuthProviderType(request.type),
                clientId: request.oauth2Config?.clientId,
                clientSecret: request.oauth2Config?.clientSecret,
                tokenUrl: request.oauth2Config?.tokenUrl,
                authorizationUrl: request.oauth2Config?.authorizationUrl,
            });

            return new CreateAuthProviderResponse({ authProvider: this.apiConverter.toAuthProvider(result) });
        } else {
            const result = await this.authProviderService.createAuthProviderOfUser(ctxUserId(), {
                host: request.host,
                ownerId: ctxUserId(),
                type: this.apiConverter.fromAuthProviderType(request.type),
                clientId: request.oauth2Config?.clientId,
                clientSecret: request.oauth2Config?.clientSecret,
                tokenUrl: request.oauth2Config?.tokenUrl,
                authorizationUrl: request.oauth2Config?.authorizationUrl,
            });

            return new CreateAuthProviderResponse({ authProvider: this.apiConverter.toAuthProvider(result) });
        }
    }
    async getAuthProvider(request: GetAuthProviderRequest, _: HandlerContext): Promise<GetAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "authProviderId is required");
        }

        const authProvider = await this.authProviderService.getAuthProvider(ctxUserId(), request.authProviderId);
        if (!authProvider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider not found.");
        }

        return new GetAuthProviderResponse({
            authProvider: this.apiConverter.toAuthProvider(authProvider),
        });
    }

    async listAuthProviders(request: ListAuthProvidersRequest, _: HandlerContext): Promise<ListAuthProvidersResponse> {
        const target = request.id;
        const ownerId = target.case === "userId" ? target.value : "";
        const organizationId = target.case === "organizationId" ? target.value : "";

        if (!uuidValidate(organizationId) && !uuidValidate(ownerId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId or ownerId is required");
        }

        const authProviders = organizationId
            ? await this.authProviderService.getAuthProvidersOfOrg(ctxUserId(), organizationId)
            : await this.authProviderService.getAuthProvidersOfUser(ctxUserId());

        const selectedProviders = selectPage(authProviders, request.pagination);
        const redacted = selectedProviders.map(AuthProviderEntry.redact.bind(AuthProviderEntry));

        const result = new ListAuthProvidersResponse({
            authProviders: redacted.map((ap) => this.apiConverter.toAuthProvider(ap)),
            pagination: {
                total: redacted.length,
            },
        });
        return result;
    }

    /**
     * Listing descriptions of auth providers doesn't require authentication.
     */
    @Unauthenticated()
    async listAuthProviderDescriptions(
        request: ListAuthProviderDescriptionsRequest,
        _: HandlerContext,
    ): Promise<ListAuthProviderDescriptionsResponse> {
        const userId = ctxTrySubjectId()?.userId();
        let user: User | undefined = undefined;
        if (userId) {
            user = await this.userService.findUserById(userId, userId);
        }
        const aps = user
            ? await this.authProviderService.getAuthProviderDescriptions(user)
            : await this.authProviderService.getAuthProviderDescriptionsUnauthenticated();

        const selectedProviders = selectPage(aps, request.pagination);
        return new ListAuthProviderDescriptionsResponse({
            descriptions: selectedProviders.map((ap: AuthProviderInfo) =>
                this.apiConverter.toAuthProviderDescription(ap),
            ),
        });
    }

    async updateAuthProvider(
        request: UpdateAuthProviderRequest,
        _: HandlerContext,
    ): Promise<UpdateAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "authProviderId is required");
        }
        const clientId = request.clientId;
        const clientSecret = request.clientSecret;
        if (!clientId && !clientSecret) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "clientId or clientSecret are required");
        }

        const authProvider = await this.authProviderService.getAuthProvider(ctxUserId(), request.authProviderId);
        if (!authProvider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider not found.");
        }

        let entry: AuthProviderEntry;
        if (authProvider.organizationId) {
            entry = await this.authProviderService.updateOrgAuthProvider(ctxUserId(), {
                id: request.authProviderId,
                organizationId: authProvider.organizationId,
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: request.authorizationUrl,
                tokenUrl: request.tokenUrl,
            });
        } else {
            entry = await this.authProviderService.updateAuthProviderOfUser(ctxUserId(), {
                id: request.authProviderId,
                ownerId: ctxUserId(),
                clientId: clientId,
                clientSecret: clientSecret,
                authorizationUrl: request.authorizationUrl,
                tokenUrl: request.tokenUrl,
            });
        }

        return new UpdateAuthProviderResponse({
            authProvider: this.apiConverter.toAuthProvider(AuthProviderEntry.redact(entry)),
        });
    }

    async deleteAuthProvider(
        request: DeleteAuthProviderRequest,
        _: HandlerContext,
    ): Promise<DeleteAuthProviderResponse> {
        if (!request.authProviderId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "authProviderId is required");
        }

        const authProvider = await this.authProviderService.getAuthProvider(ctxUserId(), request.authProviderId);
        if (!authProvider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider not found.");
        }

        if (authProvider.organizationId) {
            await this.authProviderService.deleteAuthProviderOfOrg(
                ctxUserId(),
                authProvider.organizationId,
                request.authProviderId,
            );
        } else {
            await this.authProviderService.deleteAuthProviderOfUser(ctxUserId(), request.authProviderId);
        }

        return new DeleteAuthProviderResponse();
    }
}

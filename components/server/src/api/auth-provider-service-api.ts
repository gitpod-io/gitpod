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

@injectable()
export class AuthProviderServiceAPI implements ServiceImpl<typeof AuthProviderServiceInterface> {
    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    async createAuthProvider(
        req: CreateAuthProviderRequest,
        context: HandlerContext,
    ): Promise<CreateAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    async getAuthProvider(req: GetAuthProviderRequest, context: HandlerContext): Promise<GetAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    async listAuthProviders(
        req: ListAuthProvidersRequest,
        context: HandlerContext,
    ): Promise<ListAuthProvidersResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    async listAuthProviderDescriptions(
        req: ListAuthProviderDescriptionsRequest,
        context: HandlerContext,
    ): Promise<ListAuthProviderDescriptionsResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    async updateAuthProvider(
        req: UpdateAuthProviderRequest,
        context: HandlerContext,
    ): Promise<UpdateAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
    async deleteAuthProvider(
        req: DeleteAuthProviderRequest,
        context: HandlerContext,
    ): Promise<DeleteAuthProviderResponse> {
        throw new ConnectError("unimplemented", Code.Unimplemented);
    }
}

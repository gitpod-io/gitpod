/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ServiceImpl } from "@connectrpc/connect";
import { HandlerContext } from "@connectrpc/connect/dist/cjs/implementation";
import { TokenService as TokenServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/token_connect";
import {
    CreateTemporaryAccessTokenRequest,
    CreateTemporaryAccessTokenResponse,
} from "@gitpod/public-api/lib/gitpod/v1/token_pb";
import { inject, injectable } from "inversify";
import { SessionHandler } from "../session-handler";
import { ctxUserId } from "../util/request-context";
import { Authorizer } from "../authorization/authorizer";
import { validate as uuidValidate } from "uuid";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class TokenServiceAPI implements ServiceImpl<typeof TokenServiceInterface> {
    @inject(SessionHandler) private readonly session: SessionHandler;
    @inject(Authorizer) private readonly auth: Authorizer;

    async createTemporaryAccessToken(
        req: CreateTemporaryAccessTokenRequest,
        _: HandlerContext,
    ): Promise<CreateTemporaryAccessTokenResponse> {
        const isDataOps = await getExperimentsClientForBackend().getValueAsync("dataops", false, {});
        if (!isDataOps) {
            throw new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented");
        }
        if (!uuidValidate(req.userId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "userId is required");
        }
        if (!req.expirySeconds || req.expirySeconds < 0 || req.expirySeconds > 600) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "expirySeconds must be between 0 and 600");
        }
        const ctxUserID = ctxUserId();
        await this.auth.checkPermissionOnUser(ctxUserID, "write_temporary_token", req.userId);

        const newToken = await this.session.createJWTSessionCookie(req.userId, {
            expirySeconds: req.expirySeconds,
        });
        log.debug("Temporary access token created", { targetUser: req.userId });

        return new CreateTemporaryAccessTokenResponse({
            cookieName: newToken.name,
            token: newToken.value,
        });
    }
}

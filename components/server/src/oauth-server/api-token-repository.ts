/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    DateInterval,
    OAuthClient,
    OAuthScope,
    OAuthToken,
    OAuthTokenRepository,
    OAuthUser,
} from "@jmondi/oauth2-server";
import { inject, injectable } from "inversify";
// import { Authorizer } from "../authorization/authorizer";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";
import { ApiAccessToken, ApiTokenScope } from "../auth/api-token";
import { AuthJWT } from "../auth/jwt";
import { Authorizer } from "../authorization/authorizer";

// OAuth token expiry
const tokenExpiryInFuture = new DateInterval("7d");

@injectable()
export class ApiTokenRepository implements OAuthTokenRepository {
    constructor(
        @inject(AuthJWT) private readonly authJWT: AuthJWT,
        @inject(Authorizer) private readonly authorizer: Authorizer,
    ) {}

    async issueToken(client: OAuthClient, scopes: OAuthScope[], user?: OAuthUser): Promise<OAuthToken> {
        if (!user) {
            // this would otherwise break persisting of an DBOAuthAuthCodeEntry in AuthCodeRepositoryDB
            throw new Error("Cannot issue auth code for unknown user.");
        }
        log.info("issuing token", { userId: user?.id, scopes });

        const expiry = tokenExpiryInFuture.getEndDate();
        const apiToken = ApiAccessToken.create(scopes.map((s) => ApiTokenScope.decode(s.name)));
        const accessToken = await apiToken.encode(this.authJWT);
        return <OAuthToken>{
            accessToken,
            accessTokenExpiresAt: expiry,
            client,
            user,
            scopes: scopes,
        };
    }

    async persist(accessToken: OAuthToken): Promise<void> {
        const scopes = accessToken.scopes.map((s) => s.name);

        log.info("persisting token", { accessToken: new TrustedValue(accessToken), scopes });
        const apiAccessToken = await ApiAccessToken.parse(accessToken.accessToken, this.authJWT);
        await this.authorizer.addApiToken(apiAccessToken.id, apiAccessToken.scopes);

        // // Does the token already exist?
        // let dbToken: GitpodToken;
        // const tokenHash = crypto.createHash("sha256").update(accessToken.accessToken, "utf8").digest("hex");
        // const userAndToken = await this.findUserByGitpodToken(tokenHash);
        // if (userAndToken) {
        //     // Yes, update it (~)
        //     // NOTE(rl): as we don't support refresh tokens yet this is not really required
        //     // since the OAuth server lib calls issueRefreshToken immediately after issueToken
        //     // We do not allow changes of name, type, user or scope.
        //     dbToken = userAndToken.token as GitpodToken & { user: DBUser };
        //     const repo = await this.getGitpodTokenRepo();
        //     await repo.update(tokenHash, dbToken);
        //     return;
        // } else {
        //     if (!accessToken.user) {
        //         log.error({}, "No user in accessToken", { accessToken });
        //         return;
        //     }
        //     dbToken = {
        //         tokenHash,
        //         name: accessToken.client.id,
        //         type: GitpodTokenType.MACHINE_AUTH_TOKEN,
        //         userId: accessToken.user.id.toString(),
        //         scopes: scopes,
        //         created: new Date().toISOString(),
        //     };
        //     return this.storeGitpodToken(dbToken);
        // }
    }

    async revoke(accessTokenToken: OAuthToken): Promise<void> {
        log.info("deleting token", { accessTokenToken: new TrustedValue(accessTokenToken) });
    }

    // NOTE(gpl): refresh is not implemented
    async issueRefreshToken(accessToken: OAuthToken): Promise<OAuthToken> {
        // // NOTE(rl): this exists for the OAuth server code - Gitpod tokens are non-refreshable (atm)
        // accessToken.refreshToken = "refreshtokentoken";
        // accessToken.refreshTokenExpiresAt = new DateInterval("30d").getEndDate();
        // await this.persist(accessToken);
        return accessToken;
    }

    async isRefreshTokenRevoked(refreshToken: OAuthToken): Promise<boolean> {
        return Date.now() > (refreshToken.refreshTokenExpiresAt?.getTime() ?? 0);
    }

    async getByRefreshToken(refreshTokenToken: string): Promise<OAuthToken> {
        throw new Error("Not implemented");
    }
}

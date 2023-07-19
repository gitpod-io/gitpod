/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AuthorizationServer,
    DateInterval,
    JwtService,
    OAuthAuthCodeRepository,
    OAuthTokenRepository,
    OAuthUserRepository,
} from "@jmondi/oauth2-server";
import { inMemoryClientRepository, inMemoryScopeRepository } from "./repository";

export const clientRepository = inMemoryClientRepository;
const scopeRepository = inMemoryScopeRepository;

export function createAuthorizationServer(
    authCodeRepository: OAuthAuthCodeRepository,
    userRepository: OAuthUserRepository,
    tokenRepository: OAuthTokenRepository,
    jwtSecret: string,
): AuthorizationServer {
    const authorizationServer = new AuthorizationServer(
        clientRepository,
        tokenRepository,
        scopeRepository,
        new JwtService(jwtSecret),
        {
            // Be explicit, communicate intent. Default is true but let's not assume that
            requiresPKCE: true,
        },
    );

    authorizationServer.enableGrantType(
        { grant: "authorization_code", userRepository, authCodeRepository },
        new DateInterval("5m"),
    );
    authorizationServer.enableGrantType("refresh_token");
    return authorizationServer;
}

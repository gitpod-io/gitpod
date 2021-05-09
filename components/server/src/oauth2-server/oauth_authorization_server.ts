/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthorizationRequest, AuthorizationServer, DateInterval, GrantIdentifier, JwtService, RequestInterface, ResponseInterface } from "@jmondi/oauth2-server";
import {
  inMemoryAccessTokenRepository,
  inMemoryAuthCodeRepository,
  inMemoryClientRepository,
  inMemoryScopeRepository,
  inMemoryUserRepository,
} from "./repository";

const clientRepository = inMemoryClientRepository;
const authCodeRepository = inMemoryAuthCodeRepository;
const tokenRepository = inMemoryAccessTokenRepository;
const scopeRepository = inMemoryScopeRepository;
const userRepository = inMemoryUserRepository;

const jwtService = new JwtService("secret secret secret");

class MyAuthorizationServer extends AuthorizationServer {
  enableGrantType(grantType: GrantIdentifier, accessTokenTTL?: DateInterval): void {
    log.info(`enableGrantType: ${grantType}:${JSON.stringify(accessTokenTTL)}`)
    super.enableGrantType(grantType, accessTokenTTL);
  }
  respondToAccessTokenRequest(req: RequestInterface, res: ResponseInterface): Promise<ResponseInterface> {
    log.info(`respondToAccessTokenRequest: ${JSON.stringify(req.body)}`)
    // const grantType = this.getGrant('authorization_code')
    // log.info(`respond grant type: ${JSON.stringify(grantType)}`)
    // return grantType.respondToAccessTokenRequest(req, res, grantType.accessTokenTTL);
    return super.respondToAccessTokenRequest(req, res)
  }
  validateAuthorizationRequest(req: RequestInterface): Promise<AuthorizationRequest> {
    log.info(`validateAuthorizationRequest: ${JSON.stringify(req.query)}`)
    return super.validateAuthorizationRequest(req)
  }
  completeAuthorizationRequest(authorizationRequest: AuthorizationRequest): Promise<ResponseInterface> {
    log.info(`completeAuthorizationRequest: ${JSON.stringify(authorizationRequest)}`)
    return super.completeAuthorizationRequest(authorizationRequest)
  }
}

const authorizationServer = new MyAuthorizationServer(
  authCodeRepository,
  clientRepository,
  tokenRepository,
  scopeRepository,
  userRepository,
  jwtService,
);

authorizationServer.enableGrantType("authorization_code", new DateInterval('1d'));

export { authorizationServer as inMemoryAuthorizationServer };
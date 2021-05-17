/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthorizationRequest, AuthorizationServer, DateInterval, GrantIdentifier, JwtService, OAuthAuthCodeRepository, OAuthClient, OAuthTokenRepository, OAuthUserRepository, RequestInterface, ResponseInterface } from "@jmondi/oauth2-server";
import {
  inMemoryClientRepository,
  inMemoryScopeRepository
} from "./repository";

const clientRepository = inMemoryClientRepository;
const scopeRepository = inMemoryScopeRepository;

// TODO(rl) - get this from external secret
const jwtService = new JwtService("secret secret secret");

class GitpodAuthorizationServer extends AuthorizationServer {
  enableGrantType(grantType: GrantIdentifier, accessTokenTTL?: DateInterval): void {
    log.info(`enableGrantType: ${grantType}:${JSON.stringify(accessTokenTTL)}`)
    super.enableGrantType(grantType, accessTokenTTL);
  }
  async respondToAccessTokenRequest(req: RequestInterface, res: ResponseInterface): Promise<ResponseInterface> {
    log.info(`respondToAccessTokenRequest: ${JSON.stringify(req.body)}`)
    const result = await super.respondToAccessTokenRequest(req, res)
    log.info(`respondToAccessTokenRequest returned: ${JSON.stringify(result)}`)
    return result
  }
  validateAuthorizationRequest(req: RequestInterface): Promise<AuthorizationRequest> {
    log.info(`validateAuthorizationRequest: ${JSON.stringify(req.query)}`)
    return super.validateAuthorizationRequest(req)
  }
  completeAuthorizationRequest(authorizationRequest: AuthorizationRequest): Promise<ResponseInterface> {
    log.info(`completeAuthorizationRequest: ${JSON.stringify(authorizationRequest)}`)
    return super.completeAuthorizationRequest(authorizationRequest)
  }
  async getClientByIdentifier(clientId: string): Promise<OAuthClient> {
    log.info(`getClientByIdentifier: ${clientId}`)
    // this is a little hacky but it is not exposed by the lib
    return clientRepository.getByIdentifier(clientId);
  }
}

export function createAuthorizationServer(authCodeRepository: OAuthAuthCodeRepository, userRepository: OAuthUserRepository, tokenRepository: OAuthTokenRepository): GitpodAuthorizationServer {
  const authorizationServer = new GitpodAuthorizationServer(
    authCodeRepository,
    clientRepository,
    tokenRepository,
    scopeRepository,
    userRepository,
    jwtService,
  );

  authorizationServer.enableGrantType("authorization_code", new DateInterval('1d'));
  return authorizationServer;
}

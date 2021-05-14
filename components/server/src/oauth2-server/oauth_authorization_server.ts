/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthCodeGrant, AuthorizationRequest, AuthorizationServerOptions, ClientCredentialsGrant, DateInterval, GrantIdentifier, GrantInterface, ImplicitGrant, JwtInterface, JwtService, OAuthAuthCodeRepository, OAuthClient, OAuthClientRepository, OAuthException, OAuthScopeRepository, OAuthTokenRepository, OAuthUserRepository, PasswordGrant, RefreshTokenGrant, RequestInterface, ResponseInterface } from "@jmondi/oauth2-server";
import {
  inMemoryAccessTokenRepository,
  inMemoryClientRepository,
  inMemoryScopeRepository
} from "./repository";

const clientRepository = inMemoryClientRepository;
const tokenRepository = inMemoryAccessTokenRepository;
const scopeRepository = inMemoryScopeRepository;

const jwtService = new JwtService("secret secret secret");

export class AuthorizationServer {
  private readonly enabledGrantTypes: { [key: string]: GrantInterface } = {};
  private readonly grantTypeAccessTokenTTL: { [key: string]: DateInterval } = {};

  private readonly availableGrants: { [key in GrantIdentifier]: GrantInterface } = {
    authorization_code: new AuthCodeGrant(
      this.authCodeRepository,
      this.clientRepository,
      this.tokenRepository,
      this.scopeRepository,
      this.userRepository,
      this.jwt,
    ),
    client_credentials: new ClientCredentialsGrant(
      this.authCodeRepository,
      this.clientRepository,
      this.tokenRepository,
      this.scopeRepository,
      this.userRepository,
      this.jwt,
    ),
    implicit: new ImplicitGrant(
      this.authCodeRepository,
      this.clientRepository,
      this.tokenRepository,
      this.scopeRepository,
      this.userRepository,
      this.jwt,
    ),
    password: new PasswordGrant(
      this.authCodeRepository,
      this.clientRepository,
      this.tokenRepository,
      this.scopeRepository,
      this.userRepository,
      this.jwt,
    ),
    refresh_token: new RefreshTokenGrant(
      this.authCodeRepository,
      this.clientRepository,
      this.tokenRepository,
      this.scopeRepository,
      this.userRepository,
      this.jwt,
    ),
  };

  private options: AuthorizationServerOptions;

  constructor(
    private readonly authCodeRepository: OAuthAuthCodeRepository,
    private readonly clientRepository: OAuthClientRepository,
    private readonly tokenRepository: OAuthTokenRepository,
    private readonly scopeRepository: OAuthScopeRepository,
    private readonly userRepository: OAuthUserRepository,
    private readonly jwt: JwtInterface,
    options?: Partial<AuthorizationServerOptions>,
  ) {
    this.setOptions(options);
  }

  setOptions(options: Partial<AuthorizationServerOptions> = {}) {
    this.options = {
      requiresPKCE: true,
      ...options,
    };
  }

  enableGrantType(grantType: GrantIdentifier, accessTokenTTL: DateInterval = new DateInterval("1h")): void {
    const grant = this.availableGrants[grantType];
    grant.options = this.options;
    this.enabledGrantTypes[grantType] = grant;
    this.grantTypeAccessTokenTTL[grantType] = accessTokenTTL;
  }

  respondToAccessTokenRequest(req: RequestInterface, res: ResponseInterface): Promise<ResponseInterface> {
    for (const grantType of Object.values(this.enabledGrantTypes)) {
      log.info(`respondToAccessTokenRequest ${grantType.identifier}`)
      if (!grantType.canRespondToAccessTokenRequest(req)) {
        log.info(`respondToAccessTokenRequest ${grantType.identifier} failed`)
        continue;
      }
      const accessTokenTTL = this.grantTypeAccessTokenTTL[grantType.identifier];
      log.info(`respondToAccessTokenRequest ${grantType.identifier} TTL: ${accessTokenTTL}`)
      return grantType.respondToAccessTokenRequest(req, res, accessTokenTTL);
    }

    log.info(`respondToAccessTokenRequest unsupported`)
    throw OAuthException.unsupportedGrantType();
  }

  validateAuthorizationRequest(req: RequestInterface): Promise<AuthorizationRequest> {
    for (const grant of Object.values(this.enabledGrantTypes)) {
      log.info(`validateAuthorizationRequest ${grant.identifier}`)
      if (grant.canRespondToAuthorizationRequest(req)) {
        log.info(`validateAuthorizationRequest ${grant.identifier} can respond`)
        return grant.validateAuthorizationRequest(req);
      }
      log.info(`validateAuthorizationRequest ${grant.identifier} cannot respond`)
    }
    log.info(`validateAuthorizationRequest unsupported`)
    throw OAuthException.unsupportedGrantType();
  }

  async completeAuthorizationRequest(authorizationRequest: AuthorizationRequest): Promise<ResponseInterface> {
    const grant = this.enabledGrantTypes[authorizationRequest.grantTypeId];
    return await grant.completeAuthorizationRequest(authorizationRequest);
  }

  /**
   * I am only using this in testing... should it be here?
   * @param grantType
   */
  getGrant(grantType: GrantIdentifier): any {
    return this.availableGrants[grantType];
  }
}

class GitpodAuthorizationServer extends AuthorizationServer {
  enableGrantType(grantType: GrantIdentifier, accessTokenTTL?: DateInterval): void {
    log.info(`enableGrantType: ${grantType}:${JSON.stringify(accessTokenTTL)}`)
    super.enableGrantType(grantType, accessTokenTTL);
  }
  async respondToAccessTokenRequest(req: RequestInterface, res: ResponseInterface): Promise<ResponseInterface> {
    log.info(`respondToAccessTokenRequest: ${JSON.stringify(req.body)}`)
    // const grantType = this.getGrant('authorization_code')
    // log.info(`respond grant type: ${JSON.stringify(grantType)}`)
    // return grantType.respondToAccessTokenRequest(req, res, grantType.accessTokenTTL);
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

export function createAuthorizationServer(authCodeRepository: OAuthAuthCodeRepository, userRepository: OAuthUserRepository): GitpodAuthorizationServer {
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

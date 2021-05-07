/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthorizationServer, DateInterval, JwtService } from "@jmondi/oauth2-server";
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

const authorizationServer = new AuthorizationServer(
  authCodeRepository,
  clientRepository,
  tokenRepository,
  scopeRepository,
  userRepository,
  jwtService,
);

authorizationServer.enableGrantType("authorization_code", new DateInterval("1m"));

export { authorizationServer as inMemoryAuthorizationServer };
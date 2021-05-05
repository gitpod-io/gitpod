/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import * as crypto from 'crypto';
import encode from 'base64url';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { User } from '@gitpod/gitpod-protocol';

const check = /[^\w.\-~]/;

/**
 * These functions are based on the PKCE helper code from https://github.com/panva/node-oidc-provider
 */ 

// Check that the PKCE value meets the specifications
export function checkFormat(input: string, name: string) {
  if (input.length < 43) {
    throw new Error(`${name} must be a string with a minimum length of 43 characters`);
  }

  if (input.length > 128) {
    throw new Error(`${name} must be a string with a maximum length of 128 characters`);
  }

  if (check.test(input)) {
    throw new Error(`${name} contains invalid characters`);
  }
};

// Check that the supplied challenge matches the verifier value according to the specified method
export function verifyPKCE(verifier: string, challenge: string, method: string): boolean {  
    if (verifier || challenge) {
      
      try {
        let expected = verifier;
        assert(expected);
        checkFormat(expected, 'code_verifier');
    
        if (method === 'S256') {
          expected = encode(crypto.createHash('sha256').update(expected).digest());
        }
  
        assert.equal(challenge, expected);
        return true;

      } catch (err) {
        log.error(`Invalid grant: PKCE verification failed`)
      }
    }
    return false;
  };

// Preserve the code challenge values per user
// NOTE: this will need to move to the db or some other external store
//       as server needs to be stateless
const challenges = new WeakMap();

interface State {
    challenge: string;  // code_challange from PKCE
    code_hash: string; // the authorization code hash
}

// Get the authentication state, if any, for the specified user
export function userState(user: User): State {
  if (!challenges.has(user)) challenges.set(user, {});
  return challenges.get(user);
}
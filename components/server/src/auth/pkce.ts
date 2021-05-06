/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import { injectable } from "inversify";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import * as assert from 'assert';
import encode from 'base64url';
import * as crypto from 'crypto';
// import { EncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";
import { EncryptionEngine, EncryptionEngineImpl } from "@gitpod/gitpod-protocol/lib/encryption/encryption-engine";

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
  if (!['PLAIN', 'S256'].includes(method)) {
    log.error(`invalid method ${method}`);
    return false;
  }

  if (verifier || challenge) {
    try {
      let expected = verifier;
      checkFormat(expected, 'code_verifier');

      if (method === 'S256') {
        expected = encode(crypto.createHash('sha256').update(expected).digest());
      }

      assert.strictEqual(challenge, expected);
      return true;

    } catch (err) {
      log.error(`Invalid grant: PKCE verification failed ${err}`)
    }
  }
  return false;
};

interface AuthenticationCode {
  random: string,
  challenge: string,
  time: string,
  method: string,
};

interface Challenge {
  challenge: string,
  method: string,
}

@injectable()
export class PKCEAuthCoder {

  // @inject(EncryptionService) protected readonly encryptionService: EncryptionService;
  protected encryptionEngine: EncryptionEngine;
  protected key: Buffer;

  // @postConstruct()
  // init() {
  constructor() {
    // TODO: FIXME!
    this.key = Buffer.from('jJgYSA69K7HMNWvUxY20dtKddDZuT4+vpGSBdKBAc0U=', 'base64');
    this.encryptionEngine = new EncryptionEngineImpl();
  }

  // Creates an encrypted code to be returned when authenticating.
  // It includes the challenge and method to avoid requirement for state in server.
  // TODO: remove 'any'
  public encode(challenge: string, method: string): string {
    const code: AuthenticationCode = {
      random: crypto.randomBytes(42 / 2).toString('hex'),
      challenge: challenge,
      time: Date.now().toLocaleString(),
      method: method,
    };
    return JSON.stringify(this.encryptionEngine.encrypt(JSON.stringify(code), this.key));
  }

  // Extract the challenge values from the configuration code
  public decode(code: string): Challenge {
    const decryptedCode = JSON.parse(this.encryptionEngine.decrypt(JSON.parse(code), this.key)) as AuthenticationCode;
    return {
      challenge: decryptedCode.challenge,
      method: decryptedCode.method,
    }
  }
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as crypto from 'crypto';
import { injectable } from 'inversify';

export interface KeyParams {
  iv: string;
}

export interface EncryptedData {
  /** utf8 encoded string */
  data: string;
  keyParams: KeyParams;
}

export const EncryptionEngine = Symbol('EncryptionEngine');
export interface EncryptionEngine {
  /**
   * @param data utf8 encoded string
   */
  encrypt(data: string, key: Buffer): EncryptedData;
  decrypt(encryptedData: EncryptedData, key: Buffer): string;
}

/**
 * For starters, let's use aes-cbc-256 with:
 * - 16 bytes/128 bits IV (the size of an aes-256-cbc block)
 * - no salt, as we pass in a real key (no salting needed to turn a password into a key)
 * The implementation closely follows the exampes in https://nodejs.org/api/crypto.html.
 */
@injectable()
export class EncryptionEngineImpl {
  readonly algorithm = 'aes-256-cbc';
  readonly enc = 'base64';

  encrypt(data: string, key: Buffer): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = cipher.update(new Buffer(data, 'utf8'));
    const finalEncrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
      data: finalEncrypted.toString(this.enc),
      keyParams: {
        iv: iv.toString(this.enc),
      },
    };
  }

  decrypt(encryptedData: EncryptedData, key: Buffer): string {
    const decipher = crypto.createDecipheriv(this.algorithm, key, new Buffer(encryptedData.keyParams.iv, this.enc));
    let decrypted = decipher.update(new Buffer(encryptedData.data, this.enc));
    const finalDecrypted = Buffer.concat([decrypted, decipher.final()]);
    return finalDecrypted.toString('utf8');
  }
}

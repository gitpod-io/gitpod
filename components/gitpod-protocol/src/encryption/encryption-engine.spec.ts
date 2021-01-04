/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test } from "mocha-typescript";
import * as chai from 'chai';
import * as path from 'path';
import * as fs from "fs";

import { EncryptionEngineImpl } from "./encryption-engine";

const expect = chai.expect;

@suite class TestEncryptionEngineImpl {
    // Created with openssl rand -rand /dev/urandom -out key -base64 32
    protected get testkey () {
        const keyFilePath = path.resolve(__dirname, '../../test/fixtures/encryption/testkey');
        const keyBuffer = fs.readFileSync(keyFilePath);
        return keyBuffer.toString().trim();
    };

    @test basicSymmetry() {
        const plaintext = "12345678901234567890";
        const key = new Buffer(this.testkey, 'base64');

        const cut = new EncryptionEngineImpl();
        const encryptedData = cut.encrypt(plaintext, key);
        expect(encryptedData).to.be.not.undefined;

        const decryptedPlaintext = cut.decrypt(encryptedData, key);
        expect(decryptedPlaintext).equals(plaintext);
    }
}
export const t = new TestEncryptionEngineImpl();
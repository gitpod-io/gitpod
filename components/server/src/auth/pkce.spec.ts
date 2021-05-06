/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
import * as crypto from 'crypto';
import { suite, test } from 'mocha-typescript';
import * as pkce from './pkce';

const expect = chai.expect;

@suite
export class PKCESpec {

    @test public canCheckFormat() {
        expect(() => pkce.checkFormat('', 'empty')).to.throw(/minimum length of 43 characters/);
        // NOTE: converting to hex will double length
        expect(() => pkce.checkFormat(crypto.randomBytes(42/2).toString('hex'), '42 chars == too short')).to.throw(/minimum length of 43 characters/);
        expect(() => pkce.checkFormat(crypto.randomBytes(128/2).toString('hex') + '-', '129 chars == too long')).to.throw(/maximum length of 128 characters/);
        expect(() => pkce.checkFormat(crypto.randomBytes(42/2).toString('hex') + '0', '43 chars == just right')).to.not.throw();
        expect(() => pkce.checkFormat(crypto.randomBytes(128/2).toString('hex'), '128 chars == just right')).to.not.throw();
    }

    @test public canVerifyPKCE() {
        const validVerifier = crypto.randomBytes(42/2).toString('hex') + '0';

        expect(pkce.verifyPKCE(validVerifier, validVerifier, 'BOGUS'), 'bogus verifier').is.false;
        expect(pkce.verifyPKCE(validVerifier, validVerifier, 'plain'), 'plain verifier').is.false;
        expect(pkce.verifyPKCE(validVerifier, validVerifier, 's256'), 's256 verifier').is.false;
        expect(pkce.verifyPKCE('', '', 'S256'), 'both empty').is.false;  
        expect(pkce.verifyPKCE('', '123', 'S256'), 'verifier empty').is.false;  
        expect(pkce.verifyPKCE(validVerifier, '123', 'S256'), 'short challenge').is.false;  
        expect(pkce.verifyPKCE(validVerifier, validVerifier, 'PLAIN'), 'plain verifier').is.true;
        // Valid values from oauth 2.0 playground PKCE flow
        expect(pkce.verifyPKCE('oXPuJHLIMdGLQYOm7Z-_cO4N3WoaK6aQA0i7JKKeGGLTD7G-', 'cNerW3ccX3K10Yp5LJMSAT8ehENHcNILeGKmEbaL2pI', 'S256'), 'oauth-a').is.true;
        expect(pkce.verifyPKCE('EPZvjDwOrCzgAnOaoqyhO9OFwwsTr80GT2NvR7m-yho3HDYG', 'S1En4MvHyCZGxlXf7Uy4Aq0IFjeVLKj2vhG62U_or8s', 'S256'), 'oauth-b').is.true;
        expect(pkce.verifyPKCE('EPZvjDwOrCzgAnOaoqyhO9OFwwsTr80GT2NvR7m-yho3HDYG', 'S1En4MvHyCZGxlXf7Uy4Aq0IFjeVLKj2vhG62Uor8s', 'S256'), 'oauth-b').is.false;
    }
}

module.exports = new PKCESpec()

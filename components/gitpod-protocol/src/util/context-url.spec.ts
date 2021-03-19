/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import { contextUrlToUrl } from './context-url';
const expect = chai.expect;

@suite
export class ContextUrlTest {

    @test public parseContextUrl_withEnvVar() {
        const actual = contextUrlToUrl("passedin=test%20value/https://github.com/gitpod-io/gitpod-test-repo");
        expect(actual?.pathname).to.equal("/gitpod-io/gitpod-test-repo");
    }

    @test public parseContextUrl_withPrebuild() {
        const actual = contextUrlToUrl("prebuild/https://github.com/gitpod-io/gitpod-test-repo");
        expect(actual?.host).to.equal("github.com");
    }
}
module.exports = new ContextUrlTest()
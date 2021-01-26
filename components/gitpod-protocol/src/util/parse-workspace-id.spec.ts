/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import { parseWorkspaceIdFromHostname } from './parse-workspace-id';
const expect = chai.expect;

@suite
export class ParseWorkspaceIdTest {

    @test public parseWorkspaceIdFromHostname_fromWorkspaceLocation() {
        const actual = parseWorkspaceIdFromHostname("moccasin-ferret-155799b3.ws-eu01.gitpod.io");
        expect(actual).to.equal("moccasin-ferret-155799b3");
    }

    @test public parseWorkspaceIdFromHostname_fromWorkspacePortLocation() {
        const actual = parseWorkspaceIdFromHostname("3000-moccasin-ferret-155799b3.ws-eu01.gitpod.io");
        expect(actual).to.equal("moccasin-ferret-155799b3");
    }

    @test public parseWorkspaceIdFromHostname_fromWorkspacePortLocationWithWebviewPrefix() {
        const actual = parseWorkspaceIdFromHostname("webview-3000-moccasin-ferret-155799b3.ws-eu01.gitpod.io");
        expect(actual).to.equal("moccasin-ferret-155799b3");
    }

    @test public parseWorkspaceIdFromHostname_fromWorkspacePortLocationWithWebviewPrefixCustomHost() {
        const actual = parseWorkspaceIdFromHostname("webview-3000-moccasin-ferret-155799b3.ws-eu01.some.subdomain.somehost.com");
        expect(actual).to.equal("moccasin-ferret-155799b3");
    }

    // legacy mode
    @test public parseLegacyWorkspaceIdFromHostname_fromWorkspaceLocation() {
        const actual = parseWorkspaceIdFromHostname("b7e0eaf8-ec73-44ec-81ea-04859263b656.ws-eu01.gitpod.io");
        expect(actual).to.equal("b7e0eaf8-ec73-44ec-81ea-04859263b656");
    }

    @test public parseLegacyWorkspaceIdFromHostname_fromWorkspacePortLocation() {
        const actual = parseWorkspaceIdFromHostname("3000-b7e0eaf8-ec73-44ec-81ea-04859263b656.ws-eu01.gitpod.io");
        expect(actual).to.equal("b7e0eaf8-ec73-44ec-81ea-04859263b656");
    }

    @test public parseLegacyWorkspaceIdFromHostname_fromWorkspacePortLocationWithWebviewPrefix() {
        const actual = parseWorkspaceIdFromHostname("webview-3000-b7e0eaf8-ec73-44ec-81ea-04859263b656.ws-eu01.gitpod.io");
        expect(actual).to.equal("b7e0eaf8-ec73-44ec-81ea-04859263b656");
    }

    @test public parseLegacyWorkspaceIdFromHostname_fromWorkspacePortLocationWithWebviewPrefixCustomHost() {
        const actual = parseWorkspaceIdFromHostname("webview-3000-ca81a50f-09d7-465c-acd9-264a747d5351.ws-eu01.some.subdomain.somehost.com");
        expect(actual).to.equal("ca81a50f-09d7-465c-acd9-264a747d5351");
    }
}
module.exports = new ParseWorkspaceIdTest()
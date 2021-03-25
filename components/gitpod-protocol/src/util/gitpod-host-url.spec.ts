/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import { GitpodHostUrl } from './gitpod-host-url';
const expect = chai.expect;

@suite
export class GitpodHostUrlTest {

    @test public parseWorkspaceId_pathBased() {
        const actual = GitpodHostUrl.fromWorkspaceUrl("http://35.223.201.195/workspace/bc77e03d-c781-4235-bca0-e24087f5e472/").workspaceId;
        expect(actual).to.equal("bc77e03d-c781-4235-bca0-e24087f5e472");
    }

    @test public parseWorkspaceId_hosts_withEnvVarsInjected() {
        const actual = GitpodHostUrl.fromWorkspaceUrl("https://gray-grasshopper-nfbitfia.ws-eu02.gitpod-staging.com/#passedin=test%20value/https://github.com/gitpod-io/gitpod-test-repo").workspaceId;
        expect(actual).to.equal("gray-grasshopper-nfbitfia");
    }
}
module.exports = new GitpodHostUrlTest()
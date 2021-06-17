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

    @test public async testWithoutWorkspacePrefix() {
        expect(GitpodHostUrl.fromWorkspaceUrl("https://3000-moccasin-ferret-155799b3.ws-eu02.gitpod-staging.com/").withoutWorkspacePrefix().toString()).to.equal("https://gitpod-staging.com/");
    }

    @test public async testWithoutWorkspacePrefix2() {
        expect(GitpodHostUrl.fromWorkspaceUrl("https://gitpod-staging.com/").withoutWorkspacePrefix().toString()).to.equal("https://gitpod-staging.com/");
    }

    @test public async testWithoutWorkspacePrefix3() {
        expect(GitpodHostUrl.fromWorkspaceUrl("https://gray-rook-5523v5d8.ws-dev.my-branch-1234.staging.gitpod-dev.com/").withoutWorkspacePrefix().toString()).to.equal("https://my-branch-1234.staging.gitpod-dev.com/");
    }

    @test public async testWithoutWorkspacePrefix4() {
        expect(GitpodHostUrl.fromWorkspaceUrl("https://my-branch-1234.staging.gitpod-dev.com/").withoutWorkspacePrefix().toString()).to.equal("https://my-branch-1234.staging.gitpod-dev.com/");
    }

    @test public async testWithoutWorkspacePrefix5() {
        expect(GitpodHostUrl.fromWorkspaceUrl("https://abc-nice-brunch-4224.staging.gitpod-dev.com/").withoutWorkspacePrefix().toString()).to.equal("https://abc-nice-brunch-4224.staging.gitpod-dev.com/");
    }

    @test public async testWithoutWorkspacePrefix6() {
        expect(GitpodHostUrl.fromWorkspaceUrl("https://gray-rook-5523v5d8.ws-dev.abc-nice-brunch-4224.staging.gitpod-dev.com/").withoutWorkspacePrefix().toString()).to.equal("https://abc-nice-brunch-4224.staging.gitpod-dev.com/");
    }
}
module.exports = new GitpodHostUrlTest()
/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "@testdeck/mocha";
import { GitpodHostUrl } from "./gitpod-host-url";
const expect = chai.expect;

@suite
export class GitpodHostUrlTest {
    @test public parseWorkspaceId_hosts_withEnvVarsInjected() {
        const actual = new GitpodHostUrl(
            "https://gray-grasshopper-nfbitfia.ws-eu02.gitpod-staging.com/#passedin=test%20value/https://github.com/gitpod-io/gitpod-test-repo",
        ).workspaceId;
        expect(actual).to.equal("gray-grasshopper-nfbitfia");
    }

    @test public async testWithoutWorkspacePrefix() {
        expect(
            new GitpodHostUrl("https://3000-moccasin-ferret-155799b3.ws-eu02.gitpod-staging.com/")
                .withoutWorkspacePrefix()
                .toString(),
        ).to.equal("https://gitpod-staging.com/");
    }

    @test public async testWithoutWorkspacePrefix2() {
        expect(new GitpodHostUrl("https://gitpod-staging.com/").withoutWorkspacePrefix().toString()).to.equal(
            "https://gitpod-staging.com/",
        );
    }

    @test public async testWithoutWorkspacePrefix3() {
        expect(
            new GitpodHostUrl("https://gray-rook-5523v5d8.ws-dev.my-branch-1234.staging.gitpod-dev.com/")
                .withoutWorkspacePrefix()
                .toString(),
        ).to.equal("https://my-branch-1234.staging.gitpod-dev.com/");
    }

    @test public async testWithoutWorkspacePrefix4() {
        expect(
            new GitpodHostUrl("https://my-branch-1234.staging.gitpod-dev.com/").withoutWorkspacePrefix().toString(),
        ).to.equal("https://my-branch-1234.staging.gitpod-dev.com/");
    }

    @test public async testWithoutWorkspacePrefix5() {
        expect(
            new GitpodHostUrl("https://abc-nice-brunch-4224.staging.gitpod-dev.com/")
                .withoutWorkspacePrefix()
                .toString(),
        ).to.equal("https://abc-nice-brunch-4224.staging.gitpod-dev.com/");
    }

    @test public async testWithoutWorkspacePrefix6() {
        expect(
            new GitpodHostUrl("https://gray-rook-5523v5d8.ws-dev.abc-nice-brunch-4224.staging.gitpod-dev.com/")
                .withoutWorkspacePrefix()
                .toString(),
        ).to.equal("https://abc-nice-brunch-4224.staging.gitpod-dev.com/");
    }
}
module.exports = new GitpodHostUrlTest();

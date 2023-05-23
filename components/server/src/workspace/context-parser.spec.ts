/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { IssueContexts } from "./context-parser";
import { User } from "@gitpod/gitpod-protocol";
const expect = chai.expect;

const baseUserInfo: User = {
    id: "1",
    creationDate: "today :)",
    identities: [],
    name: "John Doe",
};

@suite
class TestIssueContexts {
    @test
    public testSanitizeAndFormatBranchName() {
        const user: User = { ...baseUserInfo };
        const issueTitle = "Issue Title With Special Characters like * ? @ {";
        const issueNr = 1;
        const result = IssueContexts.toBranchName(user, issueTitle, issueNr);
        expect(result).to.equal("john-doe/issue-title-with-special-1");
    }

    @test
    public testHandleNonAlphanumericCharactersInUserName() {
        const user: User = { name: "John*Doe", ...baseUserInfo };
        const issueTitle = "Simple Issue Title";
        const issueNr = 2;
        const result = IssueContexts.toBranchName(user, issueTitle, issueNr);
        expect(result).to.equal("john-doe/simple-issue-title-2");
    }

    @test
    public testHandleBranchNameLongerThan30Characters() {
        const user: User = { ...baseUserInfo };
        const issueTitle = "This is a really long issue title that goes beyond 30 characters";
        const issueNr = 3;
        const result = IssueContexts.toBranchName(user, issueTitle, issueNr);
        expect(result.length).to.be.at.most(IssueContexts.maxBaseBranchLength + `-${issueNr}`.length);
    }

    @test
    public testHandleEmptyIssueTitle() {
        const user: User = { ...baseUserInfo };
        const issueTitle = "";
        const issueNr = 4;
        const result = IssueContexts.toBranchName(user, issueTitle, issueNr);
        expect(result).to.equal("john-doe/4");
    }
}

module.exports = new TestIssueContexts();

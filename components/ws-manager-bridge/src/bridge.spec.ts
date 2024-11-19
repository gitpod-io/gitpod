/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { WorkspaceConditions, WorkspaceStatus } from "@gitpod/ws-manager/lib";
import { hasRelevantDiff } from "./bridge";

const expect = chai.expect;

function createTestStatus(statusVersion: number, failed: string): WorkspaceStatus {
    const conditions = new WorkspaceConditions();
    conditions.setFailed(failed);
    const status = new WorkspaceStatus();
    status.setStatusVersion(statusVersion);
    status.setConditions(conditions);
    return status;
}

@suite
class TestBridge {
    @test public testWorkspaceStatus_hasRelevantDiff() {
        const a = createTestStatus(123, "why on why");
        const actual1 = hasRelevantDiff(a, a);
        expect(actual1, "identical: no diff").to.be.false;

        const b = createTestStatus(124, "why on why");
        const actual2 = hasRelevantDiff(a, b);
        expect(actual2, "should be same despite different statusVersion").to.equal(false);

        const c = createTestStatus(125, "because!");
        const actual3 = hasRelevantDiff(a, c);
        expect(actual3, "different failed condition").to.equal(true);
    }
}
module.exports = new TestBridge(); // Only to circumvent no usage warning :-/

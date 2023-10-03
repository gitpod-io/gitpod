/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { isClusterMaintenanceError, isResourceExhaustedError } from "./workspace-starter";
const expect = chai.expect;

@suite
class TestWorkspaceStarter {
    @test
    public testMaintenancePreconditionError() {
        const err = {
            details: "under maintenance",
            code: 9,
        };

        const result = isClusterMaintenanceError(err);
        expect(result).to.be.true;
    }

    @test
    public testOtherPreconditionError() {
        const err = {
            details: "foobar",
            code: 9,
        };

        const result = isClusterMaintenanceError(err);
        expect(result).to.be.false;
    }

    @test
    public testResourceExhaustedError() {
        const err = {
            code: 8,
        };

        const result = isResourceExhaustedError(err);
        expect(result).to.be.true;
    }
}

module.exports = new TestWorkspaceStarter();

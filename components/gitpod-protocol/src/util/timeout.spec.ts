/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test } from "@testdeck/mocha";
import { Timeout } from "./timeout";

@suite()
export class TimeoutSpec {
    @test
    async testSimpleRun() {
        const timeout = new Timeout(1);
        timeout.start();
        await timeout.await();
        expect(timeout.signal?.aborted).to.be.true;
    }

    @test
    async testSimpleRunNotStarted() {
        const timeout = new Timeout(1);
        await timeout.await();
        expect(timeout.signal).to.be.undefined;
    }

    @test
    async testRestart() {
        const timeout = new Timeout(20);
        timeout.start();
        await timeout.await();
        expect(timeout.signal?.aborted).to.be.true;

        timeout.restart();
        expect(timeout.signal).to.not.be.undefined;
        expect(timeout.signal?.aborted).to.be.false;
        await timeout.await();
        expect(timeout.signal?.aborted).to.be.true;
    }

    @test
    async testClear() {
        const timeout = new Timeout(1000);
        timeout.restart();
        timeout.clear();
        expect(timeout.signal).to.be.undefined;
    }

    @test
    async testAbortCondition() {
        const timeout = new Timeout(1, () => false); // will never trigger abort
        timeout.start();
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(timeout.signal).to.not.be.undefined;
        expect(timeout.signal?.aborted).to.be.false;
    }
}

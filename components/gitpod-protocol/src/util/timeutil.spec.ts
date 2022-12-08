/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test } from "mocha-typescript";
import { daysBefore, hoursBefore, oneMonthLater } from "./timeutil";

@suite()
export class TimeutilSpec {
    @test
    testDaysBefore() {
        const now = new Date().toISOString();
        expect(daysBefore(now, 2)).to.be.eq(hoursBefore(now, 48));
    }

    @test
    testTimeutil() {
        // targeting a 1st, 1th of Jan => 1st of Feb
        this.isOneMonthLater(new Date(2000, 0, 1), 1, new Date(2000, 1, 1));

        // targeting a 31th, 30th of Apr => 31st of May
        this.isOneMonthLater(new Date(2000, 3, 30), 31, new Date(2000, 4, 31));

        // targeting a 31th, 31th of Mar => 30th of Apr
        this.isOneMonthLater(new Date(2000, 2, 31), 31, new Date(2000, 3, 30));

        // targeting a 30th, 30th of Mar => 30th of Apr
        this.isOneMonthLater(new Date(2000, 2, 30), 30, new Date(2000, 3, 30));

        // next year
        this.isOneMonthLater(new Date(2000, 11, 1), 1, new Date(2001, 0, 1));
        this.isOneMonthLater(new Date(2000, 11, 31), 31, new Date(2001, 0, 31));

        // Feb
        this.isOneMonthLater(new Date(2001, 0, 31), 31, new Date(2001, 1, 28));
        // Feb leap year
        this.isOneMonthLater(new Date(2000, 0, 31), 31, new Date(2000, 1, 29));
    }

    isOneMonthLater(from: Date, day: number, expectation: Date) {
        const later = oneMonthLater(from.toISOString(), day);
        expect(later, `expected ${later} to be equal ${expectation}`).to.be.equal(expectation.toISOString());
    }

    @test
    testDaysBefore2() {
        const tests: { date: Date; daysEarlier: number; expectation: string }[] = [
            {
                date: new Date("2021-07-13T00:00:00.000Z"),
                daysEarlier: 365,
                expectation: "2020-07-13T00:00:00.000Z",
            },
            {
                date: new Date("2019-02-01T00:00:00.000Z"),
                daysEarlier: 365,
                expectation: "2018-02-01T00:00:00.000Z",
            },
        ];

        for (const t of tests) {
            const actual = daysBefore(t.date.toISOString(), t.daysEarlier);
            expect(actual).to.equal(t.expectation, `expected ${actual} to be equal ${t.expectation}`);
        }
    }
}

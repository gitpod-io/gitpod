/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { parsePagination } from "./public-api-pagination";

describe("PublicAPIConverter", () => {
    describe("parsePagination", () => {
        it("Happy path", () => {
            // first path is { page: 0 }
            const result = parsePagination({ page: 1, pageSize: 50 }, 50);
            expect(result.limit).to.equal(50);
            expect(result.offset).to.equal(50);
        });

        it("Default is more than max, limit to max", () => {
            const result = parsePagination({ page: 2 }, 5000);
            expect(result.limit).to.equal(100); // MAX_PAGE_SIZE
            expect(result.offset).to.equal(200);
        });

        it("All undefined", () => {
            const result = parsePagination({}, 20);
            expect(result.limit).to.equal(20);
            expect(result.offset).to.equal(0);
        });

        it("All undefined, default undefined, go to default 50", () => {
            const result = parsePagination({});
            expect(result.limit).to.equal(50); // DEFAULT_PAGE_SIZE
            expect(result.offset).to.equal(0);
        });

        it("Page less than zero, should go to zero", () => {
            const result = parsePagination({ page: -100, pageSize: 50 });
            expect(result.limit).to.equal(50);
            expect(result.offset).to.equal(0);
        });

        it("Not integer page to zero", () => {
            const result = parsePagination({ page: 0.1, pageSize: 20 });
            expect(result.limit).to.equal(20);
            expect(result.offset).to.equal(0);
        });

        it("Not integer pageSize to default", () => {
            const result = parsePagination({ page: 1, pageSize: 0.1 });
            expect(result.limit).to.equal(50);
            expect(result.offset).to.equal(50);
        });
    });
});

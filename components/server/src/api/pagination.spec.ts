/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { selectPage, PAGE_DEFAULT, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "./pagination";
import { PaginationRequest } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";

const expect = chai.expect;

describe("selectPage", function () {
    const a1000 = Array.from({ length: 1000 }, (_, i) => `item${i + 1}`);
    const a10 = Array.from({ length: 10 }, (_, i) => `item${i + 1}`);

    it(`should return first ${PAGE_SIZE_DEFAULT} if pagination is not specified`, function () {
        const selection = selectPage(a1000);
        expect(selection).to.have.lengthOf(PAGE_SIZE_DEFAULT);
        expect(selection[0]).to.equal(`item${PAGE_DEFAULT}`);
    });
    it(`should return first ${PAGE_SIZE_MAX} if page size exceed max`, function () {
        const selection = selectPage(a1000, new PaginationRequest({ pageSize: PAGE_SIZE_MAX + 1 }));
        expect(selection).to.have.lengthOf(PAGE_SIZE_MAX);
        expect(selection[0]).to.equal(`item${PAGE_DEFAULT}`);
    });
    it(`should return second page`, function () {
        const selection = selectPage(a1000, new PaginationRequest({ page: 2, pageSize: 50 }));
        expect(selection).to.have.lengthOf(50);
        expect(selection[0]).to.equal(`item${1 * 50 + 1}`);
        expect(selection[selection.length - 1]).to.equal(`item${2 * 50}`);
    });
    it(`should return all if it fits into a page`, function () {
        const selection = selectPage(a10, new PaginationRequest({ pageSize: 50 }));
        expect(selection).to.have.lengthOf(10);
        expect(selection[0]).to.equal(`item${1}`);
        expect(selection[selection.length - 1]).to.equal(`item${10}`);
    });
});

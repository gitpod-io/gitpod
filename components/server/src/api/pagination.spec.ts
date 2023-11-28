/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import {
    selectPage,
    PAGE_DEFAULT,
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
    generatePaginationToken,
    parsePaginationToken,
} from "./pagination";
import { PaginationRequest } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";

const expect = chai.expect;

describe("selectPage", () => {
    const a1000 = Array.from({ length: 1000 }, (_, i) => `item${i + 1}`);
    const a10 = Array.from({ length: 10 }, (_, i) => `item${i + 1}`);

    it(`should return first ${PAGE_SIZE_DEFAULT} if pagination is not specified`, () => {
        const selection = selectPage(a1000);
        expect(selection).to.have.lengthOf(PAGE_SIZE_DEFAULT);
        expect(selection[0]).to.equal(`item${PAGE_DEFAULT}`);
    });
    it(`should return first ${PAGE_SIZE_MAX} if page size exceed max`, () => {
        const selection = selectPage(a1000, new PaginationRequest({ pageSize: PAGE_SIZE_MAX + 1 }));
        expect(selection).to.have.lengthOf(PAGE_SIZE_MAX);
        expect(selection[0]).to.equal(`item${PAGE_DEFAULT}`);
    });
    it("should return second page", () => {
        const paginationToken = generatePaginationToken({ offset: 50 });
        const selection = selectPage(a1000, new PaginationRequest({ token: paginationToken, pageSize: 50 }));
        expect(selection).to.have.lengthOf(50);
        expect(selection[0]).to.equal(`item${1 * 50 + 1}`);
        expect(selection[selection.length - 1]).to.equal(`item${2 * 50}`);
    });
    it("should return all if it fits into a page", () => {
        const selection = selectPage(a10, new PaginationRequest({ pageSize: 50 }));
        expect(selection).to.have.lengthOf(10);
        expect(selection[0]).to.equal(`item${1}`);
        expect(selection[selection.length - 1]).to.equal(`item${10}`);
    });
});

describe("generatePaginationToken", () => {
    it("should generate a token", () => {
        const token = generatePaginationToken({ offset: 50 });
        expect(token).to.equal("eyJvZmZzZXQiOjUwfQ==");
    });
});

describe("parsePaginationToken", () => {
    it("should parse a valid token", () => {
        const token = generatePaginationToken({ offset: 10 });
        const result = parsePaginationToken(token);
        expect(result.offset).equals(10);
    });

    it("should return an offset of 0 if no token is provided", () => {
        const result = parsePaginationToken();
        expect(result.offset).equals(0);
    });

    it("should throw if the token is invalid", () => {
        const token = "invalidToken";
        expect(() => parsePaginationToken(token)).throws(ApplicationError);
    });

    it("should return an offset of 0 if token is valid but does not contain an offset", () => {
        const token = Buffer.from(JSON.stringify({ git: "pod" })).toString("base64");
        const result = parsePaginationToken(token);
        expect(result.offset).equals(0);
    });
});

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { createMock } from "./mock";

const expect = chai.expect;

describe("Mock", () => {
    it("should mock a method", () => {
        const mock = createMock({ foo: () => "foo" as string });
        expect(mock.foo()).to.equal("foo");
        mock.override({
            foo: () => "bar",
        });
        expect(mock.foo()).to.equal("bar");
        mock.override({
            foo: () => "baz",
        });
        expect(mock.foo()).to.equal("baz");
    });
    it("should throw if method is not mocked", () => {
        const mock = createMock<{ foo(): string }>();
        expect(() => mock.foo()).to.throw();
    });
});

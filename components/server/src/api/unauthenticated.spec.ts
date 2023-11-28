/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { Unauthenticated } from "./unauthenticated";

const expect = chai.expect;

class Foo {
    @Unauthenticated()
    async fooUnauthenticated() {}

    async foo() {}
}

describe("Unauthenticated decorator", () => {
    const foo = new Foo();

    it("function is decorated", () => {
        expect(Unauthenticated.get(foo, "fooUnauthenticated")).to.be.true;
    });
    it("function is not decorated", () => {
        expect(Unauthenticated.get(foo, "foo")).to.be.false;
    });
});

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { ApiAccessTokenV0 } from "./api-token-v0";
import { AuthJWT } from "./jwt";

const expect = chai.expect;

describe("AuthProviderService", async () => {
    let container: Container;
    let authJwt: AuthJWT;

    beforeEach(async () => {
        container = createTestContainer();
        authJwt = container.get(AuthJWT);
    });

    it("should encode+decode w/ userId", async () => {
        const userId = "u1";
        const token = new ApiAccessTokenV0(userId, [{ permission: "user_read", targetId: userId }], userId);
        const encoded = await token.encode(authJwt);

        const decodedToken = await ApiAccessTokenV0.parse(encoded, authJwt);
        expect(decodedToken).to.deep.equal(token);
    });

    it("should encode+decode w/o userId", async () => {
        const userId = "u1";
        const token = new ApiAccessTokenV0(userId, [{ permission: "user_read", targetId: userId }]);
        const encoded = await token.encode(authJwt);

        const decodedToken = await ApiAccessTokenV0.parse(encoded, authJwt);
        expect(decodedToken).to.deep.equal(token);
    });
});

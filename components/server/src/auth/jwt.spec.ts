/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import { AuthJWT, sign, verify } from "./jwt";
import { Container } from "inversify";
import { Config } from "../config";
import * as chai from "chai";
import { mockAuthConfig } from "../test/service-testing-container-module";

const expect = chai.expect;

@suite()
class TestAuthJWT {
    private container: Container;

    private config: Config = {
        auth: mockAuthConfig,
    } as Config;

    async before() {
        this.container = new Container();
        this.container.bind(Config).toConstantValue(this.config);
        this.container.bind(AuthJWT).toSelf().inSingletonScope();
    }

    @test
    async test_sign() {
        const sut = this.container.get<AuthJWT>(AuthJWT);

        const subject = "user-id";
        const encoded = await sut.sign(subject, {});

        const decoded = await verify(encoded, this.config.auth.pki.signing.publicKey, {
            algorithms: ["RS512"],
        });

        expect(decoded["sub"]).to.equal(subject);
        expect(decoded["iss"]).to.equal("https://mp-server-d7650ec945.preview.gitpod-dev.com");
    }

    @test
    async test_verify_uses_primary_first() {
        const sut = this.container.get<AuthJWT>(AuthJWT);

        const subject = "user-id";
        const encoded = await sut.sign(subject, {});

        const decoded = (await sut.verify(encoded)).payload;

        expect(decoded["sub"]).to.equal(subject);
        expect(decoded["iss"]).to.equal("https://mp-server-d7650ec945.preview.gitpod-dev.com");
    }

    @test
    async test_verify_validates_older_keys() {
        const sut = this.container.get<AuthJWT>(AuthJWT);

        const keypair = this.config.auth.pki.validating[1];
        const subject = "user-id";
        const encoded = await sign({}, keypair.privateKey, {
            algorithm: "RS512",
            expiresIn: "1d",
            issuer: this.config.auth.session.issuer,
            keyid: keypair.id,
            subject,
        });

        // should use the second validating key and succesfully verify
        const decoded = (await sut.verify(encoded)).payload;

        expect(decoded["sub"]).to.equal(subject);
        expect(decoded["iss"]).to.equal("https://mp-server-d7650ec945.preview.gitpod-dev.com");
    }
}

module.exports = new TestAuthJWT();

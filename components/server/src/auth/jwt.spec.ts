/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import { AuthJWT, sign, verify } from "./jwt";
import { Container } from "inversify";
import { Config } from "../config";
import * as crypto from "crypto";
import * as chai from "chai";

const expect = chai.expect;

@suite()
class TestAuthJWT {
    private container: Container;

    private signingKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    private validatingKeyPair1 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    private validatingKeyPair2 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

    private config: Config = {
        auth: {
            pki: {
                signing: toKeyPair("0001", this.signingKeyPair),
                validating: [toKeyPair("0002", this.validatingKeyPair1), toKeyPair("0003", this.validatingKeyPair2)],
            },
            session: {
                issuer: "https://mp-server-d7650ec945.preview.gitpod-dev.com",
                lifetimeSeconds: 7 * 24 * 60 * 60,
            },
        },
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

        const decoded = await sut.verify(encoded);

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
        const decoded = await sut.verify(encoded);

        expect(decoded["sub"]).to.equal(subject);
        expect(decoded["iss"]).to.equal("https://mp-server-d7650ec945.preview.gitpod-dev.com");
    }
}

function toKeyPair(
    id: string,
    kp: crypto.KeyPairKeyObjectResult,
): {
    id: string;
    privateKey: string;
    publicKey: string;
} {
    return {
        id,
        privateKey: kp.privateKey
            .export({
                type: "pkcs1",
                format: "pem",
            })
            .toString(),
        publicKey: kp.publicKey
            .export({
                type: "pkcs1",
                format: "pem",
            })
            .toString(),
    };
}

module.exports = new TestAuthJWT();

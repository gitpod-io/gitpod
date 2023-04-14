/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "mocha-typescript";
import { AuthJWT, sign, verify } from "./jwt";
import { Container } from "inversify";
import { Config } from "../config";
import * as crypto from "crypto";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import * as chai from "chai";

const expect = chai.expect;

@suite()
class TestAuthJWT {
    private container: Container;

    private signingKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    private validatingKeyPair1 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    private validatingKeyPair2 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

    private config: Config = {
        hostUrl: new GitpodHostUrl("https://mp-server-d7650ec945.preview.gitpod-dev.com"),
        auth: {
            pki: {
                signing: toKeyPair(this.signingKeyPair),
                validating: [toKeyPair(this.validatingKeyPair1), toKeyPair(this.validatingKeyPair2)],
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
<<<<<<< HEAD
        expect(decoded["iss"]).to.equal("https://mp-server-d7650ec945.preview.gitpod-dev.com");
=======
        expect(decoded["iss"]).to.equal("mp-server-d7650ec945.preview.gitpod-dev.com");
>>>>>>> 15ab23327 (fix)
    }

    @test
    async test_verify_uses_primary_first() {
        const sut = this.container.get<AuthJWT>(AuthJWT);

        const subject = "user-id";
        const encoded = await sut.sign(subject, {});

        const decoded = await sut.verify(encoded);

        expect(decoded["sub"]).to.equal(subject);
<<<<<<< HEAD
        expect(decoded["iss"]).to.equal("https://mp-server-d7650ec945.preview.gitpod-dev.com");
=======
        expect(decoded["iss"]).to.equal("mp-server-d7650ec945.preview.gitpod-dev.com");
>>>>>>> 15ab23327 (fix)
    }

    @test
    async test_verify_validates_older_keys() {
        const sut = this.container.get<AuthJWT>(AuthJWT);

        const subject = "user-id";
        const encoded = await sign({}, this.config.auth.pki.validating[1].privateKey, {
            algorithm: "RS512",
            expiresIn: "1d",
<<<<<<< HEAD
            issuer: this.config.hostUrl.toStringWoRootSlash(),
=======
            issuer: this.config.hostUrl.url.hostname,
>>>>>>> 15ab23327 (fix)
            subject,
        });

        // should use the second validating key and succesfully verify
        const decoded = await sut.verify(encoded);

        expect(decoded["sub"]).to.equal(subject);
<<<<<<< HEAD
        expect(decoded["iss"]).to.equal("https://mp-server-d7650ec945.preview.gitpod-dev.com");
=======
        expect(decoded["iss"]).to.equal("mp-server-d7650ec945.preview.gitpod-dev.com");
>>>>>>> 15ab23327 (fix)
    }
}

function toKeyPair(kp: crypto.KeyPairKeyObjectResult): {
    privateKey: string;
    publicKey: string;
} {
    return {
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

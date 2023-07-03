/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import { SignInJWT } from "./jwt";
import { Container } from "inversify";
import { Config } from "../config";
import * as crypto from "crypto";
import * as chai from "chai";
import { AuthFlow } from "./auth-provider";

const expect = chai.expect;

@suite()
class TestSigninJWT {
    private container: Container;

    private signingKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

    private config: Config = {
        auth: {
            pki: {
                signing: toKeyPair("0001", this.signingKeyPair),
            },
        },
    } as Config;

    async before() {
        this.container = new Container();
        this.container.bind(Config).toConstantValue(this.config);
        this.container.bind(SignInJWT).toSelf().inSingletonScope();
    }

    @test
    async test_sign_verify() {
        const sut = this.container.get<SignInJWT>(SignInJWT);

        const flow: AuthFlow = {
            host: "https://my.awesome.host",
            returnTo: "https://here.is.gitpod/signin/callback",
            overrideScopes: true,
        };
        const encoded = await sut.sign(flow);
        const decoded = await sut.verify(encoded);

        expect({
            host: decoded.host,
            returnTo: decoded.returnTo,
            overrideScopes: decoded.overrideScopes,
        }).to.deep.eq(flow);
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

module.exports = new TestSigninJWT();

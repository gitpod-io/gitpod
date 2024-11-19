/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import jsonwebtoken from "jsonwebtoken";
import { Config } from "../config";
import { inject, injectable, postConstruct } from "inversify";
import { AuthFlow } from "./auth-provider";

const authJWTAlgorithm: jsonwebtoken.Algorithm = "RS512";

@injectable()
export class AuthJWT {
    @inject(Config) protected config: Config;

    async sign(
        subject: string,
        payload: object | Buffer,
        expirySeconds: number = this.config.auth.session.lifetimeSeconds,
        issuer: string = this.config.auth.session.issuer,
    ): Promise<string> {
        const opts: jsonwebtoken.SignOptions = {
            algorithm: authJWTAlgorithm,
            expiresIn: expirySeconds,
            issuer,
            subject,
            keyid: this.config.auth.pki.signing.id,
        };

        return sign(payload, this.config.auth.pki.signing.privateKey, opts);
    }

    async verify(encoded: string): Promise<{ payload: jsonwebtoken.JwtPayload; keyId: string }> {
        const keypairs = [this.config.auth.pki.signing, ...this.config.auth.pki.validating];
        const publicKeysByID = keypairs.reduce<{ [id: string]: string }>((byID, keypair) => {
            byID[keypair.id] = keypair.publicKey;
            return byID;
        }, {});

        // When we verify an encoded token, we first read the Key ID from the token header (without verifying the signature)
        // and then lookup the appropriate key from out collection of available keys.
        const decodedWithoutVerification = decodeWithoutVerification(encoded);
        const keyID = decodedWithoutVerification.header.kid;

        if (!keyID) {
            throw new Error("JWT token does not contain kid (key id) property.");
        }

        if (!publicKeysByID[keyID]) {
            throw new Error("JWT was signed with an unknown key id");
        }

        // Given we know which keyid this token was presumably signed with, let's verify the token using the public key.
        const verified = await verify(encoded, publicKeysByID[keyID], {
            algorithms: [authJWTAlgorithm],
        });

        return {
            payload: verified,
            keyId: keyID,
        };
    }
}

const signinJWTAlgorithm: jsonwebtoken.Algorithm = "HS256";

@injectable()
export class SignInJWT {
    @inject(Config) protected config: Config;

    private key: string;

    @postConstruct()
    init() {
        // Having another secret for the symmetric algorithm of HS256 would be overkill,
        // we re-use the RSA private key as the symmetric key, by dropping the // START / END markers.
        const lines = this.config.auth.pki.signing.privateKey.split("\n");
        // drop the first line
        lines.shift();
        // drop the last line
        lines.pop();

        this.key = lines.join("\n");
    }

    async sign(payload: AuthFlow, expirySeconds: number = 5 * 60): Promise<string> {
        const opts: jsonwebtoken.SignOptions = {
            algorithm: signinJWTAlgorithm,
            expiresIn: expirySeconds,
        };

        return sign(payload, this.key, opts);
    }

    async verify(encoded: string): Promise<AuthFlow> {
        // For signin JWT, we always verify with our PKI Signing PK
        const verified = await verify(encoded, this.key, {
            algorithms: [signinJWTAlgorithm],
        });

        if (!AuthFlow.is(verified)) {
            throw new Error("Encoded sign-in JWT is not a valid AuthFlow object.");
        }

        return verified;
    }
}

export async function sign(
    payload: string | object | Buffer,
    secret: jsonwebtoken.Secret,
    opts: jsonwebtoken.SignOptions,
): Promise<string> {
    return new Promise((resolve, reject) => {
        jsonwebtoken.sign(payload, secret, opts, (err, encoded) => {
            if (err || !encoded) {
                return reject(err);
            }
            return resolve(encoded);
        });
    });
}

export async function verify(
    encoded: string,
    publicKey: string,
    opts: jsonwebtoken.VerifyOptions,
): Promise<jsonwebtoken.JwtPayload> {
    return new Promise((resolve, reject) => {
        jsonwebtoken.verify(encoded, publicKey, opts, (err, decoded) => {
            if (err || !decoded) {
                return reject(err);
            }
            resolve(decoded as jsonwebtoken.JwtPayload);
        });
    });
}

export function decodeWithoutVerification(encoded: string, options?: jsonwebtoken.DecodeOptions): jsonwebtoken.Jwt {
    const decoded = jsonwebtoken.decode(encoded, { ...options, complete: true });
    if (!decoded) {
        throw new Error("Failed to decode JWT");
    }
    if (typeof decoded === "string") {
        throw new Error("Decoded JWT was a string, JSON payload required.");
    }

    return decoded;
}

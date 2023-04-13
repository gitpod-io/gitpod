/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as jsonwebtoken from "jsonwebtoken";
import { Config } from "../config";
import { inject, injectable } from "inversify";

const algorithm: jsonwebtoken.Algorithm = "RS512";

@injectable()
export class AuthJWT {
    @inject(Config) protected config: Config;

    async sign(subject: string, payload: object | Buffer, expiresIn: string = `${24 * 7}h`) {
        const opts: jsonwebtoken.SignOptions = {
            algorithm,
            expiresIn,
            issuer: this.config.hostUrl.toString(),
            subject,
        };

        return new Promise((resolve, reject) => {
            jsonwebtoken.sign(payload, this.config.auth.pki.signing.privateKey, opts, (err, encoded) => {
                if (err || !encoded) {
                    return reject(err);
                }
                return resolve(encoded);
            });
        });
    }

    async verify(encoded: string): Promise<object> {
        const publicKeys = [
            this.config.auth.pki.signing.publicKey, // signing key is checked first
            ...this.config.auth.pki.validating.map((keypair) => keypair.publicKey),
        ];

        let lastErr;
        for (let publicKey of publicKeys) {
            try {
                const decoded = verify(encoded, publicKey, {
                    algorithms: [algorithm],
                });
                return decoded;
            } catch (err) {
                lastErr = err;
            }
        }

        throw lastErr;
    }
}

async function verify(
    encoded: string,
    publicKey: string,
    opts: jsonwebtoken.VerifyOptions,
): Promise<jsonwebtoken.JwtPayload> {
    return new Promise((resolve, reject) => {
        jsonwebtoken.verify(encoded, publicKey, opts, (err, decoded) => {
            if (err || !decoded) {
                return reject(err);
            }
            resolve(decoded);
        });
    });
}

export async function newSessionJWT(userID: string): Promise<string> {
    const payload = {
        // subject
        sub: userID,
        // issuer
        iss: "gitpod.io",
    };
    const temporaryTestKeyForExperimentation = "my-secret";

    return new Promise((resolve, reject) => {
        jsonwebtoken.sign(payload, temporaryTestKeyForExperimentation, { algorithm: "HS256" }, function (err, token) {
            if (err || !token) {
                return reject(err);
            }
            return resolve(token);
        });
    });
}

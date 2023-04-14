/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as jsonwebtoken from "jsonwebtoken";
import { Config } from "../config";
import { inject, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

const algorithm: jsonwebtoken.Algorithm = "RS512";

@injectable()
export class AuthJWT {
    @inject(Config) protected config: Config;

    async sign(subject: string, payload: object | Buffer, expiresIn: string = `${24 * 7}h`): Promise<string> {
        const opts: jsonwebtoken.SignOptions = {
            algorithm,
            expiresIn,
            issuer: this.config.hostUrl.url.hostname,
            subject,
        };

        return sign(payload, this.config.auth.pki.signing.privateKey, opts);
    }

    async verify(encoded: string): Promise<jsonwebtoken.JwtPayload> {
        // When we verify an encoded token, we verify it using all available public keys
        // That is, we check the following:
        //  * The current signing public key
        //  * All other validating public keys, in order
        //
        // We do this to allow for key-rotation. But tokens already issued would fail to validate
        // if the signing key was changed. To accept older sessions, which are still valid
        // we need to check for older keys also.
        const validatingPublicKeys = this.config.auth.pki.validating.map((keypair) => keypair.publicKey);
        const publicKeys = [
            this.config.auth.pki.signing.publicKey, // signing key is checked first
            ...validatingPublicKeys,
        ];

        let lastErr;
        for (let publicKey of publicKeys) {
            try {
                const decoded = await verify(encoded, publicKey, {
                    algorithms: [algorithm],
                });
                return decoded;
            } catch (err) {
                log.debug(`Failed to verify JWT token using public key.`, err);
                lastErr = err;
            }
        }

        log.error(`Failed to verify JWT using any available public key.`, lastErr, {
            publicKeyCount: publicKeys.length,
        });
        throw lastErr;
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
            resolve(decoded);
        });
    });
}

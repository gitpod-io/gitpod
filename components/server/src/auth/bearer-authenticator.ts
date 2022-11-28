/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { UserDB, PersonalAccessTokenDB } from "@gitpod/gitpod-db/lib";
import { GitpodTokenType, User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import * as crypto from "crypto";
import * as express from "express";
import { IncomingHttpHeaders } from "http";
import { inject, injectable } from "inversify";
import { AllAccessFunctionGuard, ExplicitFunctionAccessGuard, WithFunctionAccessGuard } from "./function-access";
import { TokenResourceGuard, WithResourceAccessGuard } from "./resource-access";

export function getBearerToken(headers: IncomingHttpHeaders): string | undefined {
    const authorizationHeader = headers["authorization"];
    if (!authorizationHeader || !(typeof authorizationHeader === "string")) {
        return;
    }
    if (!authorizationHeader.startsWith("Bearer ")) {
        return;
    }

    return authorizationHeader.substring("Bearer ".length);
}

const bearerAuthCode = "BearerAuth";
interface BearerAuthError extends Error {
    code: typeof bearerAuthCode;
}
export function isBearerAuthError(error: Error): error is BearerAuthError {
    return "code" in error && (error as any)["code"] === bearerAuthCode;
}
function createBearerAuthError(message: string): BearerAuthError {
    return Object.assign(new Error(message), { code: bearerAuthCode } as { code: typeof bearerAuthCode });
}

@injectable()
export class BearerAuth {
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PersonalAccessTokenDB) protected readonly personalAccessTokenDB: PersonalAccessTokenDB;

    get restHandler(): express.RequestHandler {
        return async (req, res, next) => {
            try {
                await this.auth(req);
            } catch (e) {
                if (isBearerAuthError(e)) {
                    // (AT) while investigating https://github.com/gitpod-io/gitpod/issues/8703 we
                    // came to the assumption that a workspace pod might start talking to a server pod
                    // from the other cluster, which is not db-sync'd yet.
                    // Logging this should allow us to test this assumption.
                    log.info("Bearer auth error.", e, { clientRegion: req.get("x-glb-client-region") });
                    res.status(401).send(e.message);
                    return;
                }
                return next(e);
            }
            return next();
        };
    }

    get restHandlerOptionally(): express.RequestHandler {
        return async (req, res, next) => {
            try {
                await this.auth(req);
            } catch (e) {
                // don't error the request, we just have not bearer authentication token
            }
            return next();
        };
    }

    async auth(req: express.Request): Promise<void> {
        const token = getBearerToken(req.headers);
        if (!token) {
            throw createBearerAuthError("missing Bearer token");
        }

        const { user, scopes } = await this.userAndScopesFromToken(token);

        const resourceGuard = new TokenResourceGuard(user.id, scopes);
        (req as WithResourceAccessGuard).resourceGuard = resourceGuard;

        const functionScopes = scopes
            .filter((s) => s.startsWith("function:"))
            .map((s) => s.substring("function:".length));
        if (functionScopes.length === 1 && functionScopes[0] === "*") {
            (req as WithFunctionAccessGuard).functionGuard = new AllAccessFunctionGuard();
        } else {
            // We always install a function access guard. If the token has no scopes, it's not allowed to do anything.
            (req as WithFunctionAccessGuard).functionGuard = new ExplicitFunctionAccessGuard(functionScopes);
        }

        req.user = user;
    }

    private async userAndScopesFromToken(token: string): Promise<{ user: User; scopes: string[] }> {
        // We handle two types of Bearer tokens:
        //  1. Personal Access Tokens which are prefixed with `gitpod_pat_`
        //  2. Old(er) access tokens which do not have any specific prefix.

        if (PersonalAccessToken.validatePrefix(token)) {
            try {
                const validated = PersonalAccessToken.validate(token);
                const hash = validated.hash();

                const pat = await this.personalAccessTokenDB.getByHash(hash);
                if (!pat) {
                    throw new Error("Failed to find PAT by hash");
                }

                const userByID = await this.userDB.findUserById(pat.userId);
                if (!userByID) {
                    throw new Error("Failed to find user referenced by PAT");
                }

                return { user: userByID, scopes: pat.scopes };
            } catch (e) {
                log.error("Failed to authenticate using PAT", e);
                // We must not leak error details to the user.
                throw createBearerAuthError("Invalid personal access token");
            }
        }

        const hash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
        const userAndToken = await this.userDB.findUserByGitpodToken(hash, GitpodTokenType.API_AUTH_TOKEN);
        if (!userAndToken) {
            throw createBearerAuthError("invalid Bearer token");
        }

        // hack: load the user again to get ahold of all identities
        // TODO(cw): instead of re-loading the user, we should properly join the identities in findUserByGitpodToken
        const user = (await this.userDB.findUserById(userAndToken.user.id))!;
        return { user, scopes: userAndToken.token.scopes };
    }
}

// PersonalAccessToken implements persing and validation of Personal Access Tokens (PATs).
// PATs are created on the Public API, however, server needs to understand them to be able to authorize calls with them.
// See public-api-server/auth/tokens.go
export class PersonalAccessToken {
    // a PAT has a fixed prefix, which uniquely identifies it from other tokens.
    private static PAT_PREFIX = "gitpod_pat_";

    signature: string;
    value: string;

    public constructor(signature: string, value: string) {
        this.signature = signature;
        this.value = value;
    }

    public hash(): string {
        return crypto.createHash("sha256").update(this.value, "utf8").digest("hex");
    }

    public static validatePrefix(token: string): boolean {
        return token.startsWith(PersonalAccessToken.PAT_PREFIX);
    }

    public static parse(token: string): PersonalAccessToken {
        if (!PersonalAccessToken.validatePrefix(token)) {
            throw new Error("Invalid PAT prefix");
        }

        const [signature, value] = token.substring(PersonalAccessToken.PAT_PREFIX.length).split(".", 2);

        if (!signature) {
            throw new Error("Invalid PAT signature.");
        }

        if (!value) {
            throw new Error("Invalid PAT value.");
        }

        return new PersonalAccessToken(signature, value);
    }

    public static validate(token: string): PersonalAccessToken {
        const parsed = PersonalAccessToken.parse(token);

        // TODO: Validate signature

        return parsed;
    }
}

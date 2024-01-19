/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserDB, PersonalAccessTokenDB } from "@gitpod/gitpod-db/lib";
import { GitpodTokenType, User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import * as crypto from "crypto";
import express from "express";
import { inject, injectable } from "inversify";
import { Config } from "../config";
import {
    AllAccessFunctionGuard,
    ExplicitFunctionAccessGuard,
    FunctionAccessGuard,
    WithFunctionAccessGuard,
} from "./function-access";
import { TokenResourceGuard, WithResourceAccessGuard } from "./resource-access";
import { UserService } from "../user/user-service";
import { SubjectId } from "./subject-id";
import { AuthJWT } from "./jwt";
import { ApiAccessTokenV0 } from "./api-token-v0";

export function getBearerToken(authorizationHeader: string | undefined | null): string | undefined {
    if (!authorizationHeader || !(typeof authorizationHeader === "string")) {
        return undefined;
    }
    if (!authorizationHeader.startsWith("Bearer ")) {
        return undefined;
    }

    return authorizationHeader.substring("Bearer ".length);
}

const bearerAuthCode = "BearerAuth";
interface BearerAuthError extends Error {
    code: typeof bearerAuthCode;
}
export function isBearerAuthError(error: any): error is BearerAuthError {
    return "code" in error && (error as any)["code"] === bearerAuthCode;
}
function createBearerAuthError(message: string): BearerAuthError {
    return Object.assign(new Error(message), { code: bearerAuthCode } as { code: typeof bearerAuthCode });
}

@injectable()
export class BearerAuth {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(UserService) private readonly userService: UserService,
        @inject(PersonalAccessTokenDB) private readonly personalAccessTokenDB: PersonalAccessTokenDB,
        @inject(AuthJWT) private readonly authJWT: AuthJWT,
    ) {}

    get restHandler(): express.RequestHandler {
        return async (req, res, next) => {
            try {
                await this.authExpressRequest(req);
            } catch (e) {
                if (isBearerAuthError(e)) {
                    // (AT) while investigating https://github.com/gitpod-io/gitpod/issues/8703 we
                    // came to the assumption that a workspace pod might start talking to a server pod
                    // from the other cluster, which is not periodic delete'd yet.
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
                await this.authExpressRequest(req);
            } catch (e) {
                // don't error the request, we just have not bearer authentication token
            }
            return next();
        };
    }

    async authExpressRequest(req: express.Request): Promise<void> {
        const token = getBearerToken(req.headers["authorization"]);
        if (!token) {
            throw createBearerAuthError("missing Bearer token");
        }

        const subject = await this.subjectFromToken(token);
        if (SubjectId.is(subject)) {
            // DON'T set req.user here: we are not allowed to _impersonate_ but have to use the subjectId instead.
            // Contract:
            //  - impersonation-based authorization (JWT cookies, old scope-based Bearer tokens) sets req.user
            //  - FGA-based authorization (FGA-backed Bearer tokens) sets req.subjectId
            //  - when evaulating which authorization to use, we check for req.subjectId first, then req.user
            //    - !! this is important to avoid privilege escalation (restricted token -> impersonating user)
            req.subjectId = subject;
            return;
        }

        // legacy, resource/functions based access guards
        const { user, scopes } = subject;

        const resourceGuard = new TokenResourceGuard(user.id, scopes);
        (req as WithResourceAccessGuard).resourceGuard = resourceGuard;

        const { isAllAccessFunctionGuard, functionScopes } = FunctionAccessGuard.extractFunctionScopes(scopes);
        if (isAllAccessFunctionGuard) {
            (req as WithFunctionAccessGuard).functionGuard = new AllAccessFunctionGuard();
        } else {
            // We always install a function access guard. If the token has no scopes, it's not allowed to do anything.
            (req as WithFunctionAccessGuard).functionGuard = new ExplicitFunctionAccessGuard(functionScopes);
        }

        req.user = user;
    }

    async tryAuthFromHeaders(headers: Headers): Promise<SubjectId | undefined> {
        const token = getBearerToken(headers.get("authorization"));
        if (!token) {
            return undefined;
        }

        // FGA-backed tokens that map to a SubjectId?
        const subject = await this.subjectFromToken(token);
        if (SubjectId.is(subject)) {
            return subject;
        }
        const { user, scopes } = subject;

        // gpl: Once we move PAT to FGA-backed scopes, this special case will go away, and covered by a different SubjectIdKind.
        const { isAllAccessFunctionGuard } = FunctionAccessGuard.extractFunctionScopes(scopes);
        if (!isAllAccessFunctionGuard) {
            return undefined;
        }

        return SubjectId.fromUserId(user.id);
    }

    // TODO(gpl) { user, scopes } will go away once we move FGA-backed auth.
    private async subjectFromToken(token: string): Promise<{ user: User; scopes: string[] } | SubjectId> {
        // We handle two types of Bearer tokens:
        //  1. Personal Access Tokens which are prefixed with `gitpod_pat_`
        //  2. Old(er) access tokens which do not have any specific prefix.

        // Personal access tokens are only enabled when a signing key is configured.
        if (PersonalAccessToken.validatePrefix(token)) {
            if (this.config.patSigningKey === "") {
                throw new Error("Received Personal Access Token for authentication, but no signing key is configured.");
            }

            try {
                const parsed = PersonalAccessToken.parse(token);
                if (!parsed.validate(this.config.patSigningKey)) {
                    throw new Error("PAT does not have a valid signature.");
                }

                const hash = parsed.hash();

                const pat = await this.personalAccessTokenDB.getByHash(hash);
                if (!pat) {
                    throw new Error("Failed to find PAT by hash");
                }

                const userByID = await this.userService.findUserById(pat.userId, pat.userId);
                return { user: userByID, scopes: pat.scopes };
            } catch (e) {
                log.error("Failed to authenticate using PAT", e);
                // We must not leak error details to the user.
                throw createBearerAuthError("Invalid personal access token");
            }
        }

        if (ApiAccessTokenV0.validatePrefix(token)) {
            try {
                const parsed = await ApiAccessTokenV0.parse(token, this.authJWT);
                return parsed.subjectId();
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

        // load the user through user-service again to get ahold of all identities
        const user = await this.userService.findUserById(userAndToken.user.id, userAndToken.user.id);
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

    public validate(signingKey: string): boolean {
        const hs256 = crypto.createHmac("sha256", signingKey);
        const data = hs256.update(this.value);
        const signedValue = data.digest("base64url");

        return constantTimeCompare(this.signature, signedValue);
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
}

// https://til.simonwillison.net/node/constant-time-compare-strings
function constantTimeCompare(a: string, b: string): boolean {
    try {
        return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
    } catch {
        return false;
    }
}

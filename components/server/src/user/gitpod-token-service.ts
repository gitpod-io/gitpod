/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import { DBGitpodToken, UserDB } from "@gitpod/gitpod-db/lib";
import { GitpodToken, GitpodTokenType } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/authorizer";

@injectable()
export class GitpodTokenService {
    constructor(
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(Authorizer) private readonly auth: Authorizer,
    ) {}

    async getGitpodTokens(requestorId: string, userId: string): Promise<GitpodToken[]> {
        const user = await this.userDB.findUserById(userId);
        await this.auth.checkPermissionOnUser(requestorId, "read_tokens", userId, user);
        const gitpodTokens = await this.userDB.findAllGitpodTokensOfUser(userId);
        return gitpodTokens.filter((v) => !v.deleted);
    }

    async generateNewGitpodToken(
        requestorId: string,
        userId: string,
        options: { name?: string; type: GitpodTokenType; scopes?: string[] },
        oldPermissionCheck?: (dbToken: DBGitpodToken) => Promise<void>, // @deprecated
    ): Promise<string> {
        const user = await this.userDB.findUserById(userId);
        await this.auth.checkPermissionOnUser(requestorId, "write_tokens", userId, user);
        const token = crypto.randomBytes(30).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
        const dbToken: DBGitpodToken = {
            tokenHash,
            name: options.name,
            type: options.type,
            userId,
            scopes: options.scopes || [],
            created: new Date().toISOString(),
        };
        if (oldPermissionCheck) {
            await oldPermissionCheck(dbToken);
        }
        await this.userDB.storeGitpodToken(dbToken);
        return token;
    }

    async findGitpodToken(requestorId: string, userId: string, tokenHash: string): Promise<GitpodToken | undefined> {
        const user = await this.userDB.findUserById(userId);
        await this.auth.checkPermissionOnUser(requestorId, "read_tokens", userId, user);
        let token: GitpodToken | undefined;
        try {
            token = await this.userDB.findGitpodTokensOfUser(userId, tokenHash);
        } catch (error) {
            log.error({ userId }, "failed to resolve gitpod token: ", error);
        }
        if (token?.deleted) {
            token = undefined;
        }
        return token;
    }

    async deleteGitpodToken(
        requestorId: string,
        userId: string,
        tokenHash: string,
        oldPermissionCheck?: (token: GitpodToken) => Promise<void>, // @deprecated
    ): Promise<void> {
        const user = await this.userDB.findUserById(userId);
        await this.auth.checkPermissionOnUser(requestorId, "write_tokens", userId, user);
        const existingTokens = await this.getGitpodTokens(requestorId, userId);
        const tkn = existingTokens.find((token) => token.tokenHash === tokenHash);
        if (!tkn) {
            throw new Error(`User ${requestorId} tries to delete a token ${tokenHash} that does not exist.`);
        }
        if (oldPermissionCheck) {
            await oldPermissionCheck(tkn);
        }
        await this.userDB.deleteGitpodToken(tokenHash);
    }
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AdditionalUserData, GitpodToken, GitpodTokenType, Identity, IdentityLookup, Token, TokenEntry, User, UserEnvVar } from "@gitpod/gitpod-protocol";
import { OAuthTokenRepository, OAuthUserRepository } from "@jmondi/oauth2-server";
import { Repository } from "typeorm";
import { DBUser } from "./typeorm/entity/db-user";

export type MaybeUser = User | undefined;

export const UserDB = Symbol('UserDB');
export interface UserDB extends OAuthUserRepository, OAuthTokenRepository {
    transaction<T>(code: (db: UserDB) => Promise<T>): Promise<T>;

    newUser(): Promise<User>;
    storeUser(newUser: User): Promise<User>;
    updateUserPartial(partial: PartialUserUpdate): Promise<void>;
    findUserById(id: string): Promise<MaybeUser>;
    findUserByIdentity(identity: IdentityLookup): Promise<MaybeUser>;
    findIdentitiesByName(identity: Pick<Identity, 'authProviderId' | 'authName'>): Promise<Identity[]>;

    /**
     * Gets the number of users.
     *
     * @param excludeBuiltinUsers substract the builtin-users from the count (currently only the user builtin-workspace-prober), true by default
     */
    getUserCount(excludeBuiltinUsers?: boolean): Promise<number>;

    getUserRepo(): Promise<Repository<DBUser>>;

    /**
     * stores the given token and marks any existing tokens in that identity deleted.
     *
     * @param identity
     * @param token
     */
    storeSingleToken(identity: Pick<Identity, 'authProviderId' | 'authId'>, token: Token): Promise<TokenEntry>;

    /**
     * adds the given token to the identity
     *
     * @param identity
     * @param token
     */
    addToken(identity: Pick<Identity, 'authProviderId' | 'authId'>, token: Token): Promise<TokenEntry>;

    /**
     * Will mark tokens for the given identity as deleted.
     *
     * @param identity
     * @param shouldDelete optional predicate to suppress deletion of certain entries
     */
    deleteTokens(identity: Identity, shouldDelete?: (entry: TokenEntry) => boolean): Promise<void>

    /**
     * Find TokenEntry by id
     *
     * @param uid
     */
    findTokenEntryById(uid: string): Promise<TokenEntry | undefined>;

    /**
     * Delete TokenEntry by id
     *
     * @param uid
     */
    deleteTokenEntryById(uid: string): Promise<void>;

    /**
     * Delete expired TokenEntries
     *
     * @param date All tokens with an expiry date before (older than) this ISO8601 formatted date are considered expired and will be deleted.
     */
    deleteExpiredTokenEntries(date: string): Promise<void>;

    /**
     * Update TokenEntry by id
     *
     * @param tokenEntry
     */
    updateTokenEntry(tokenEntry: Partial<TokenEntry> & Pick<TokenEntry, "uid">): Promise<void>

    /**
     * @param identity
     * @throws an error when there is more than one token
     */
    findTokenForIdentity(identity: Identity): Promise<Token | undefined>;

    /**
     *
     * @param identity
     * @param includeDeleted whether deleted tokens should be returned as well
     */
    findTokensForIdentity(identity: Identity, includeDeleted?: boolean): Promise<TokenEntry[]>;

    /**
     * returns all users using the same email
     *
     * @param email
     */
    findUsersByEmail(email: string): Promise<User[]>;

    setEnvVar(envVar: UserEnvVar): Promise<void>;
    deleteEnvVar(envVar: UserEnvVar): Promise<void>;
    getEnvVars(userId: string): Promise<UserEnvVar[]>;

    findAllUsers(offset: number, limit: number, orderBy: keyof User, orderDir: "ASC" | "DESC", searchTerm?: string, minCreationDate?: Date, maxCreationDate?: Date, excludeBuiltinUsers?: boolean): Promise<{ total: number, rows: User[] }>;
    findUserByName(name: string): Promise<User | undefined>;

    findUserByGitpodToken(tokenHash: string, tokenType?: GitpodTokenType): Promise<{ user: User, token: GitpodToken } | undefined>;
    findGitpodTokensOfUser(userId: string, tokenHash: string): Promise<GitpodToken | undefined>;
    findAllGitpodTokensOfUser(userId: string): Promise<GitpodToken[]>;
    storeGitpodToken(token: GitpodToken & { user: DBUser }): Promise<void>;
    deleteGitpodToken(tokenHash: string): Promise<void>;
    deleteGitpodTokensNamedLike(userId: string, namePattern: string): Promise<void>;
}
export type PartialUserUpdate = Partial<Omit<User, "identities">> & Pick<User, "id">

export const BUILTIN_WORKSPACE_PROBE_USER_NAME = "builtin-workspace-prober";

export interface OwnerAndRepo {
    owner: string
    repo: string
}

export type UserEmailContact = Pick<User, 'id' | 'name'>
    & { primaryEmail: string }
    & { additionalData?: Pick<AdditionalUserData, 'emailNotificationSettings'> }

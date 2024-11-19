/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import {
    GitpodToken,
    GitpodTokenType,
    Identity,
    IdentityLookup,
    SSHPublicKeyValue,
    Token,
    TokenEntry,
    User,
    UserEnvVar,
    UserEnvVarValue,
    UserSSHPublicKey,
} from "@gitpod/gitpod-protocol";
import { EncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";
import {
    DateInterval,
    ExtraAccessTokenFields,
    GrantIdentifier,
    OAuthClient,
    OAuthScope,
    OAuthToken,
    OAuthUser,
} from "@jmondi/oauth2-server";
import { inject, injectable, optional } from "inversify";
import { EntityManager, Equal, FindOperator, Not, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import {
    BUILTIN_WORKSPACE_PROBE_USER_ID,
    BUILTIN_WORKSPACE_USER_AGENT_SMITH,
    BUILTIN_INSTLLATION_ADMIN_USER_ID,
    MaybeUser,
    PartialUserUpdate,
    UserDB,
    isBuiltinUser,
} from "../user-db";
import { DBGitpodToken } from "./entity/db-gitpod-token";
import { DBIdentity } from "./entity/db-identity";
import { DBTokenEntry } from "./entity/db-token-entry";
import { DBUser } from "./entity/db-user";
import { DBUserEnvVar } from "./entity/db-user-env-vars";
import { DBUserSshPublicKey } from "./entity/db-user-ssh-public-key";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { DataCache } from "../data-cache";
import { TransactionalDBImpl } from "./transactional-db-impl";
import { TypeORM } from "./typeorm";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { filter } from "../utils";

// OAuth token expiry
const tokenExpiryInFuture = new DateInterval("7d");

const userCacheKeyPrefix = "user:";
function getUserCacheKey(id: string): string {
    return userCacheKeyPrefix + id;
}

@injectable()
export class TypeORMUserDBImpl extends TransactionalDBImpl<UserDB> implements UserDB {
    constructor(
        @inject(TypeORM) typeorm: TypeORM,
        @inject(EncryptionService) private readonly encryptionService: EncryptionService,
        @inject(DataCache) private readonly cache: DataCache,
        @optional() transactionalEM?: EntityManager,
    ) {
        super(typeorm, transactionalEM);
    }

    protected createTransactionalDB(transactionalEM: EntityManager): UserDB {
        return new TypeORMUserDBImpl(this.typeorm, this.encryptionService, this.cache, transactionalEM);
    }

    async getUserRepo(): Promise<Repository<DBUser>> {
        return (await this.getEntityManager()).getRepository<DBUser>(DBUser);
    }

    private async getTokenRepo(): Promise<Repository<DBTokenEntry>> {
        return (await this.getEntityManager()).getRepository<DBTokenEntry>(DBTokenEntry);
    }

    private async getGitpodTokenRepo(): Promise<Repository<DBGitpodToken>> {
        return (await this.getEntityManager()).getRepository<DBGitpodToken>(DBGitpodToken);
    }

    private async getUserEnvVarRepo(): Promise<Repository<DBUserEnvVar>> {
        return (await this.getEntityManager()).getRepository<DBUserEnvVar>(DBUserEnvVar);
    }

    private async getSSHPublicKeyRepo(): Promise<Repository<DBUserSshPublicKey>> {
        return (await this.getEntityManager()).getRepository<DBUserSshPublicKey>(DBUserSshPublicKey);
    }

    public async newUser(): Promise<User> {
        const user: User = {
            id: uuidv4(),
            creationDate: new Date().toISOString(),
            identities: [],
            additionalData: {
                // Please DO NOT add ideSettings prop, it'll broke onboarding of JetBrains Gateway
                // If you want to do it, ping IDE team
                // ideSettings: {},
                emailNotificationSettings: {
                    allowsChangelogMail: true,
                    allowsDevXMail: true,
                    allowsOnboardingMail: true,
                },
            },
        };
        await this.storeUser(user);
        return user;
    }

    public async storeUser(newUser: User): Promise<User> {
        const userRepo = await this.getUserRepo();
        const dbUser = this.mapUserToDBUser(newUser);
        const result = await userRepo.save(dbUser);
        await this.cache.invalidate(getUserCacheKey(dbUser.id));
        return this.mapDBUserToUser(result);
    }

    public async updateUserPartial(_partial: PartialUserUpdate): Promise<void> {
        const userRepo = await this.getUserRepo();
        const partial = { ..._partial };
        // .update does not update across one-to-many relations, which is also not what we want here (see type PartialUserUpdate)
        // Still, sometimes it's convenient to pass in a full-blown "User" here. To make that work as expected, we're ignoring "identities" here.
        delete (partial as any).identities;
        await userRepo.update(partial.id, partial);
        await this.cache.invalidate(getUserCacheKey(_partial.id));
    }

    public async findUserById(id: string): Promise<MaybeUser> {
        if (!id || id.trim() === "") {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Cannot find user without id");
        }
        return this.cache.get(getUserCacheKey(id), async () => {
            const userRepo = await this.getUserRepo();
            const result = await userRepo.findOne(id);
            if (!result) {
                return undefined;
            }
            return this.mapDBUserToUser(result);
        });
    }

    public async findUserByIdentity(identity: IdentityLookup): Promise<User | undefined> {
        const userRepo = await this.getUserRepo();
        const qBuilder = userRepo
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.identities", "identity")
            .where((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select("user1.id")
                    .from(DBUser, "user1")
                    .leftJoin("user1.identities", "identity")
                    .where(`identity.authProviderId = :authProviderId`, { authProviderId: identity.authProviderId })
                    .andWhere(`identity.authId = :authId`, { authId: identity.authId })
                    .andWhere(`identity.deleted != true`)
                    .andWhere(`user1.markedDeleted != true`)
                    .getQuery();
                return `user.id IN ${subQuery}`;
            });
        const result = await qBuilder.getOne();
        if (!result) {
            return undefined;
        }
        return this.mapDBUserToUser(result);
    }

    public async findUsersByEmail(email: string): Promise<User[]> {
        const userRepo = await this.getUserRepo();
        const qBuilder = userRepo
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.identities", "identity")
            .where((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select("identity1.userId")
                    .from(DBIdentity, "identity1")
                    .where(`identity1.primaryEmail = :email`, { email: email })
                    .andWhere(`identity1.deleted != true`)
                    .getQuery();
                return `user.markedDeleted != true AND user.id IN ${subQuery}`;
            });
        const result = await qBuilder.getMany();
        let order = (u1: User, u2: User) => u1.creationDate.localeCompare(u2.creationDate);
        if (result.length > 1) {
            const lastActivities = (await (
                await this.getEntityManager()
            ).query(`
                SELECT ws.ownerId AS userId, MAX(wsi.creationTime) AS lastActivity FROM d_b_workspace_instance AS wsi
                LEFT JOIN d_b_workspace AS ws ON (wsi.workspaceId = ws.id)
                WHERE ws.ownerId IN (${result.map((u) => `'${u.id}'`).join(", ")})
                GROUP BY ws.ownerId
            `)) as { userId?: string; lastActivity?: string }[];
            const lastActivity = (u: User) =>
                lastActivities.filter(({ userId }) => userId === u.id).map(({ lastActivity }) => lastActivity)[0];
            order = (u1: User, u2: User) => {
                const a1 = lastActivity(u1) || u1.creationDate;
                const a2 = lastActivity(u2) || u2.creationDate;
                if (!a1 && !a2) return 0;
                if (!a1) return 1;
                if (!a2) return -1;
                return -1 * a1.localeCompare(a2);
            };
        }
        return result.map((dbUser) => this.mapDBUserToUser(dbUser)).sort(order);
    }

    public async findUserByGitpodToken(
        tokenHash: string,
        tokenType?: GitpodTokenType,
    ): Promise<{ user: User; token: GitpodToken } | undefined> {
        const repo = await this.getGitpodTokenRepo();
        const qBuilder = repo.createQueryBuilder("gitpodToken");
        if (!!tokenType) {
            qBuilder.where("gitpodToken.tokenHash = :tokenHash AND gitpodToken.type = :tokenType", {
                tokenHash,
                tokenType,
            });
        } else {
            qBuilder.where("gitpodToken.tokenHash = :tokenHash", { tokenHash });
        }
        const token = await qBuilder.getOne();
        if (!token) {
            return;
        }
        // we want to make sure the full user is loaded(incl. identities)
        const user = await this.findUserById(token.userId);
        if (!user || user.markedDeleted || user.blocked) {
            return;
        }
        return { user, token };
    }

    public async findGitpodTokensOfUser(userId: string, tokenHash: string): Promise<GitpodToken | undefined> {
        const repo = await this.getGitpodTokenRepo();
        const qBuilder = repo.createQueryBuilder("gitpodToken");
        qBuilder.where("userId = :userId AND gitpodToken.tokenHash = :tokenHash", { userId, tokenHash });
        return qBuilder.getOne();
    }

    public async findAllGitpodTokensOfUser(userId: string): Promise<GitpodToken[]> {
        const repo = await this.getGitpodTokenRepo();
        const qBuilder = repo.createQueryBuilder("gitpodToken");
        qBuilder.where("userId = :userId", { userId });
        return qBuilder.getMany();
    }

    public async storeGitpodToken(token: GitpodToken): Promise<void> {
        const repo = await this.getGitpodTokenRepo();
        await repo.insert(token);
        await this.cache.invalidate(getUserCacheKey(token.userId));
    }

    public async deleteGitpodToken(tokenHash: string): Promise<void> {
        const repo = await this.getGitpodTokenRepo();
        await repo.delete({ tokenHash });
    }

    public async deleteGitpodTokensNamedLike(userId: string, namePattern: string): Promise<void> {
        const repo = await this.getGitpodTokenRepo();
        await repo.delete({ userId, name: new FindOperator("like", namePattern) });
    }

    public async storeSingleToken(identity: Identity, token: Token): Promise<TokenEntry> {
        await this.deleteTokens(identity);
        return this.addToken(identity, token);
    }

    public async addToken(identity: Identity, token: Token): Promise<TokenEntry> {
        const repo = await this.getTokenRepo();
        const entry: TokenEntry = {
            uid: uuidv4(),
            authProviderId: identity.authProviderId,
            authId: identity.authId,
            token: token,
            expiryDate: token.expiryDate,
            reservedUntilDate: token.reservedUntilDate,
            refreshable: !!token.refreshToken,
        };
        return await repo.save(entry);
    }

    public async findTokenEntryById(uid: string): Promise<TokenEntry | undefined> {
        const repo = await this.getTokenRepo();
        return repo.findOne(uid);
    }

    public async deleteTokenEntryById(uid: string): Promise<void> {
        const repo = await this.getTokenRepo();
        await repo.delete(uid);
    }

    public async deleteExpiredTokenEntries(date: string): Promise<void> {
        const repo = await this.getTokenRepo();
        await repo
            .createQueryBuilder()
            .delete()
            .from(DBTokenEntry)
            .where("expiryDate != ''")
            .andWhere("refreshable != 1")
            .andWhere("expiryDate <= :date", { date })
            .execute();
    }

    public async updateTokenEntry(tokenEntry: Partial<TokenEntry> & Pick<TokenEntry, "uid">): Promise<void> {
        const repo = await this.getTokenRepo();
        await repo.update(tokenEntry.uid, tokenEntry);
    }

    public async deleteTokens(identity: Identity, shouldDelete?: (entry: TokenEntry) => boolean): Promise<void> {
        const existingTokens = await this.findTokensForIdentity(identity);
        const repo = await this.getTokenRepo();
        for (const existing of existingTokens) {
            if (!shouldDelete || shouldDelete(existing)) {
                await repo.delete(existing.uid);
            }
        }
    }

    public async findTokenEntryForIdentity(identity: Identity): Promise<TokenEntry | undefined> {
        const tokenEntries = await this.findTokensForIdentity(identity);
        if (tokenEntries.length > 1) {
            // TODO(gpl) This line is very noisy thus we don't want it to be a warning. Still we need to keep track,
            // so needs to be an info.
            log.info(`Found more than one active token for ${identity.authProviderId}.`, { identity });
        }
        if (tokenEntries.length === 0) {
            return undefined;
        }
        const latestTokenEntry = tokenEntries
            .sort((a, b) => `${a.token.updateDate}`.localeCompare(`${b.token.updateDate}`))
            .reverse()[0];
        if (!latestTokenEntry) {
            return undefined;
        }
        return {
            ...latestTokenEntry,
            token: {
                // Take dates from the TokenEntry, as only those are being updated in the DB atm
                ...latestTokenEntry.token,
                expiryDate: latestTokenEntry.expiryDate,
                reservedUntilDate: latestTokenEntry.reservedUntilDate,
            },
        };
    }

    public async findTokensForIdentity(identity: Identity): Promise<TokenEntry[]> {
        const repo = await this.getTokenRepo();
        const entry = await repo.find({ authProviderId: identity.authProviderId, authId: identity.authId });
        return entry;
    }

    private mapUserToDBUser(user: User): DBUser {
        const dbUser: DBUser = { ...user, identities: [] };
        for (const identity of user.identities) {
            dbUser.identities.push({ ...identity, user: dbUser });
        }
        return dbUser;
    }

    private mapDBUserToUser(dbUser: DBUser): User {
        const res = {
            ...dbUser,
            identities: dbUser.identities.map((i) => {
                const identity = { ...i };
                delete (identity as any).user;
                return identity;
            }),
        };
        return res;
    }

    public async getUserCount(excludeBuiltinUsers: boolean = true): Promise<number> {
        const userRepo = await this.getUserRepo();
        let query = `SELECT COUNT(1) AS cnt FROM d_b_user
            WHERE markedDeleted != true`;
        if (excludeBuiltinUsers) {
            query = `${query}
                AND id NOT IN ('${BUILTIN_WORKSPACE_PROBE_USER_ID}', '${BUILTIN_WORKSPACE_USER_AGENT_SMITH}', '${BUILTIN_INSTLLATION_ADMIN_USER_ID}')`;
        }
        const res = await userRepo.query(query);
        const count = res[0].cnt;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return Number.parseInt(count);
    }

    public async findEnvVar(userId: string, envVar: UserEnvVarValue): Promise<UserEnvVar | undefined> {
        const repo = await this.getUserEnvVarRepo();
        return repo.findOne({
            where: {
                userId,
                name: envVar.name,
                repositoryPattern: envVar.repositoryPattern,
                deleted: Not(Equal(true)),
            },
        });
    }

    public async addEnvVar(userId: string, envVar: UserEnvVarValue): Promise<UserEnvVar> {
        const repo = await this.getUserEnvVarRepo();
        return await repo.save({
            id: uuidv4(),
            userId,
            name: envVar.name,
            repositoryPattern: envVar.repositoryPattern,
            value: envVar.value,
        });
    }

    public async updateEnvVar(userId: string, envVar: Partial<UserEnvVarValue>): Promise<UserEnvVar | undefined> {
        if (!envVar.id) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "An environment variable with this ID could not be found");
        }

        return await this.transaction(async (_, ctx) => {
            const envVarRepo = ctx.entityManager.getRepository<DBUserEnvVar>(DBUserEnvVar);

            await envVarRepo.update(
                { id: envVar.id, userId, deleted: false },
                filter(envVar, (_, v) => v !== null && v !== undefined),
            );

            const found = await envVarRepo.findOne({ id: envVar.id, userId, deleted: false });
            return found;
        });
    }

    public async getEnvVars(userId: string): Promise<UserEnvVar[]> {
        const dbrepo = await this.getUserEnvVarRepo();
        const allVars = await dbrepo.find({ where: { userId } });
        return allVars.filter((envVar) => !envVar.deleted);
    }

    public async deleteEnvVar(envVar: UserEnvVar): Promise<void> {
        const repo = await this.getUserEnvVarRepo();
        await repo.update({ userId: envVar.userId, id: envVar.id }, { deleted: true });
    }

    public async hasSSHPublicKey(userId: string): Promise<boolean> {
        const repo = await this.getSSHPublicKeyRepo();
        return !!(await repo.findOne({ where: { userId } }));
    }

    public async getSSHPublicKeys(userId: string): Promise<UserSSHPublicKey[]> {
        const repo = await this.getSSHPublicKeyRepo();
        return repo.find({ where: { userId }, order: { creationTime: "ASC" } });
    }

    public async addSSHPublicKey(userId: string, value: SSHPublicKeyValue): Promise<UserSSHPublicKey> {
        const repo = await this.getSSHPublicKeyRepo();
        const fingerprint = SSHPublicKeyValue.getFingerprint(value);
        const allKeys = await repo.find({ where: { userId } });
        const prevOne = allKeys.find((e) => e.fingerprint === fingerprint);
        if (!!prevOne) {
            throw new Error(`Key already in use`);
        }
        if (allKeys.length > SSHPublicKeyValue.MAXIMUM_KEY_LENGTH) {
            throw new Error(`The maximum of public keys is ${SSHPublicKeyValue.MAXIMUM_KEY_LENGTH}`);
        }
        try {
            return await repo.save({
                id: uuidv4(),
                userId,
                fingerprint,
                name: value.name,
                key: value.key,
                creationTime: new Date().toISOString(),
                deleted: false,
            });
        } catch (err) {
            log.error("Failed to store public ssh key", err, { err });
            throw err;
        }
    }

    public async deleteSSHPublicKey(userId: string, id: string): Promise<void> {
        const repo = await this.getSSHPublicKeyRepo();
        await repo.delete({ userId, id });
    }

    public async findAllUsers(
        offset: number,
        limit: number,
        orderBy: keyof User,
        orderDir: "DESC" | "ASC",
        searchTerm?: string,
        minCreationDate?: Date,
        maxCreationDate?: Date,
        excludeBuiltinUsers?: boolean,
    ): Promise<{ total: number; rows: User[] }> {
        const userRepo = await this.getUserRepo();
        const qBuilder = userRepo.createQueryBuilder("user").leftJoinAndSelect("user.identities", "identity");
        if (searchTerm) {
            qBuilder.andWhere(
                `user.name LIKE :searchTerm
                OR user.fullName LIKE :searchTerm
                OR user.id in (
                        SELECT userid from d_b_identity AS i WHERE
                                i.deleted != true
                            AND i.primaryEmail LIKE :searchTerm
                )`,
                { searchTerm: "%" + searchTerm + "%" },
            );
        }
        if (minCreationDate) {
            qBuilder.andWhere("user.creationDate >= :minCreationDate", {
                minCreationDate: minCreationDate.toISOString(),
            });
        }
        if (maxCreationDate) {
            qBuilder.andWhere("user.creationDate < :maxCreationDate", {
                maxCreationDate: maxCreationDate.toISOString(),
            });
        }
        if (excludeBuiltinUsers) {
            qBuilder.andWhere("user.id <> :userId", { userId: BUILTIN_WORKSPACE_PROBE_USER_ID });
        }
        qBuilder.orderBy("user." + orderBy, orderDir);
        qBuilder.skip(offset).take(limit).select();
        const [rows, total] = await qBuilder.getManyAndCount();
        return { total, rows: rows.map((dbUser) => this.mapDBUserToUser(dbUser)) };
    }

    public async findUserByName(name: string): Promise<User | undefined> {
        const result = await (await this.getUserRepo()).findOne({ name });
        if (!result) {
            return undefined;
        }
        return this.mapDBUserToUser(result);
    }

    // OAuthAuthCodeRepository
    // OAuthUserRepository
    public async getUserByCredentials(
        identifier: string,
        password?: string,
        grantType?: GrantIdentifier,
        client?: OAuthClient,
    ): Promise<OAuthUser | undefined> {
        const user = await this.findUserById(identifier);
        if (user) {
            return {
                id: user.id,
                name: user.name,
            };
        }
        return;
    }
    public async extraAccessTokenFields?(user: OAuthUser): Promise<ExtraAccessTokenFields | undefined> {
        // No extra fields in token
        return;
    }

    // OAuthTokenRepository
    async issueToken(client: OAuthClient, scopes: OAuthScope[], user?: OAuthUser): Promise<OAuthToken> {
        if (!user) {
            // this would otherwise break persisting of an DBOAuthAuthCodeEntry in AuthCodeRepositoryDB
            throw new Error("Cannot issue auth code for unknown user.");
        }
        const expiry = tokenExpiryInFuture.getEndDate();
        return <OAuthToken>{
            accessToken: crypto.randomBytes(30).toString("hex"),
            accessTokenExpiresAt: expiry,
            client,
            user,
            scopes,
        };
    }
    async issueRefreshToken(accessToken: OAuthToken): Promise<OAuthToken> {
        // NOTE(rl): this exists for the OAuth server code - Gitpod tokens are non-refreshable (atm)
        accessToken.refreshToken = "refreshtokentoken";
        accessToken.refreshTokenExpiresAt = new DateInterval("30d").getEndDate();
        await this.persist(accessToken);
        return accessToken;
    }
    async persist(accessToken: OAuthToken): Promise<void> {
        const scopes = accessToken.scopes.map((s) => s.name);

        // Does the token already exist?
        let dbToken: GitpodToken;
        const tokenHash = crypto.createHash("sha256").update(accessToken.accessToken, "utf8").digest("hex");
        const userAndToken = await this.findUserByGitpodToken(tokenHash);
        if (userAndToken) {
            // Yes, update it (~)
            // NOTE(rl): as we don't support refresh tokens yet this is not really required
            // since the OAuth server lib calls issueRefreshToken immediately after issueToken
            // We do not allow changes of name, type, user or scope.
            dbToken = userAndToken.token as GitpodToken & { user: DBUser };
            const repo = await this.getGitpodTokenRepo();
            await repo.update(tokenHash, dbToken);
            return;
        } else {
            if (!accessToken.user) {
                log.error({}, "No user in accessToken", { accessToken });
                return;
            }
            dbToken = {
                tokenHash,
                name: accessToken.client.id,
                type: GitpodTokenType.MACHINE_AUTH_TOKEN,
                userId: accessToken.user.id.toString(),
                scopes: scopes,
                created: new Date().toISOString(),
            };
            return this.storeGitpodToken(dbToken);
        }
    }
    async revoke(accessTokenToken: OAuthToken): Promise<void> {
        const tokenHash = crypto.createHash("sha256").update(accessTokenToken.accessToken, "utf8").digest("hex");
        await this.deleteGitpodToken(tokenHash);
    }
    async isRefreshTokenRevoked(refreshToken: OAuthToken): Promise<boolean> {
        return Date.now() > (refreshToken.refreshTokenExpiresAt?.getTime() ?? 0);
    }
    async getByRefreshToken(refreshTokenToken: string): Promise<OAuthToken> {
        throw new Error("Not implemented");
    }

    async countUsagesOfPhoneNumber(phoneNumber: string): Promise<number> {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        return (await this.getUserRepo())
            .createQueryBuilder()
            .where("verificationPhoneNumber = :phoneNumber", { phoneNumber })
            .andWhere("creationDate > :date", { date: twoWeeksAgo.toISOString() })
            .getCount();
    }

    async isBlockedPhoneNumber(phoneNumber: string): Promise<boolean> {
        const blockedUsers = await (await this.getUserRepo())
            .createQueryBuilder()
            .where("verificationPhoneNumber = :phoneNumber", { phoneNumber })
            .andWhere("blocked = true")
            .getCount();
        return blockedUsers > 0;
    }

    async findOrgOwnedUser(organizationId: string, email: string): Promise<MaybeUser> {
        const userRepo = await this.getUserRepo();
        const qBuilder = userRepo
            .createQueryBuilder("user")
            .leftJoinAndSelect("user.identities", "identity")
            .where((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select("user1.id")
                    .from(DBUser, "user1")
                    .leftJoin("user1.identities", "identity")
                    .where(`user1.organizationId = :organizationId`, { organizationId })
                    .andWhere(`user1.markedDeleted != true`)
                    .andWhere(`identity.primaryEmail = :email`, { email })
                    .andWhere(`identity.deleted != true`)
                    .getQuery();
                return `user.id IN ${subQuery}`;
            });
        const result = await qBuilder.getOne();
        if (!result) {
            return undefined;
        }
        return this.mapDBUserToUser(result);
    }

    async findUserIdsNotYetMigratedToFgaVersion(fgaRelationshipsVersion: number, limit: number): Promise<string[]> {
        const userRepo = await this.getUserRepo();
        const users = await userRepo
            .createQueryBuilder("user")
            .where("fgaRelationshipsVersion != :fgaRelationshipsVersion", { fgaRelationshipsVersion })
            .andWhere("markedDeleted != true")
            .orderBy("_lastModified", "DESC")
            .limit(limit)
            .getMany();
        return users.map((user) => user.id).filter((id) => !isBuiltinUser(id));
    }
}

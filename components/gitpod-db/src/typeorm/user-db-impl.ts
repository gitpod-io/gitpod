/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, postConstruct } from "inversify";
import { Identity, User, IdentityLookup, Token, TokenEntry, UserEnvVar, GitpodTokenType, GitpodToken } from "@gitpod/gitpod-protocol";
import { EntityManager, Repository } from "typeorm";
import * as uuidv4 from 'uuid/v4';
import { MaybeUser, UserDB, PartialUserUpdate, BUILTIN_WORKSPACE_PROBE_USER_NAME } from "../user-db";
import { DBUser } from './entity/db-user';
import { TypeORM } from './typeorm';
import { DBIdentity } from "./entity/db-identity";
import { EncryptionService } from "@gitpod/gitpod-protocol/lib/encryption/encryption-service";
import { DBTokenEntry } from "./entity/db-token-entry";
import { DBUserEnvVar } from "./entity/db-user-env-vars";
import { DBGitpodToken } from "./entity/db-gitpod-token";
import { DBWorkspace } from "./entity/db-workspace";

/** HACK ahead: Some entities - namely DBTokenEntry for now - need access to an EncryptionService so we publish it here */
export let encryptionService: EncryptionService;

@injectable()
export class TypeORMUserDBImpl implements UserDB {

    @inject(TypeORM) protected readonly typeorm: TypeORM;
    @inject(EncryptionService) protected readonly encryptionService: EncryptionService;

    @postConstruct()
    init() {
        /** Publish the instance of EncryptionService our entities should use */
        encryptionService = this.encryptionService;
    }

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    async getUserRepo(): Promise<Repository<DBUser>> {
        return (await this.getEntityManager()).getRepository<DBUser>(DBUser);
    }
    protected async getWorkspaceRepo(): Promise<Repository<DBWorkspace>> {
        return (await this.getEntityManager()).getRepository<DBWorkspace>(DBWorkspace);
    }

    async transaction<T>(code: (db: UserDB) => Promise<T>): Promise<T> {
        const manager = await this.getEntityManager();
        return await manager.transaction(async manager => {
            return await code(new TransactionalUserDBImpl(manager));
        });
    }

    protected async getTokenRepo(): Promise<Repository<DBTokenEntry>> {
        return (await this.getEntityManager()).getRepository<DBTokenEntry>(DBTokenEntry);
    }

    protected async getIdentitiesRepo(): Promise<Repository<DBIdentity>> {
        return (await this.getEntityManager()).getRepository<DBIdentity>(DBIdentity);
    }

    protected async getGitpodTokenRepo(): Promise<Repository<DBGitpodToken>> {
        return (await this.getEntityManager()).getRepository<DBGitpodToken>(DBGitpodToken);
    }

    protected async getUserEnvVarRepo(): Promise<Repository<DBUserEnvVar>> {
        return (await this.getEntityManager()).getRepository<DBUserEnvVar>(DBUserEnvVar);
    }

    public async newUser(): Promise<User> {
        const user: User = {
            id: uuidv4(),
            creationDate: new Date().toISOString(),
            identities: [],
            allowsMarketingCommunication: false,
            additionalData: { ideSettings: { defaultIde: 'code' } },
        };
        await this.storeUser(user);
        return user;
    }

    public async storeUser(newUser: User): Promise<User> {
        const userRepo = await this.getUserRepo();
        const dbUser = this.mapUserToDBUser(newUser);
        return await userRepo.save(dbUser);
    }

    public async updateUserPartial(partial: PartialUserUpdate): Promise<void> {
        const userRepo = await this.getUserRepo();
        await userRepo.updateById(partial.id, partial);
    }

    public async findUserById(id: string): Promise<MaybeUser> {
        const userRepo = await this.getUserRepo();
        return userRepo.findOneById(id);
    }

    public async findUserByIdentity(identity: IdentityLookup): Promise<User | undefined> {
        const userRepo = await this.getUserRepo();
        const qBuilder = userRepo.createQueryBuilder('user')
            .leftJoinAndSelect("user.identities", "identity")
            .where(qb => {
                const subQuery = qb.subQuery()
                    .select("user1.id")
                    .from(DBUser, "user1")
                    .leftJoin("user1.identities", "identity")
                    .where(`identity.authProviderId = :authProviderId`, { authProviderId: identity.authProviderId })
                    .andWhere(`identity.authId = :authId`, { authId: identity.authId })
                    .andWhere(`identity.deleted != true`)
                    .andWhere(`user1.markedDeleted != true`)
                    .getQuery();
                return `user.id IN ${subQuery}`
            })
        return qBuilder.getOne();
    }

    public async findUsersByEmail(email: string): Promise<User[]> {
        const userRepo = await this.getUserRepo();
        const qBuilder = userRepo.createQueryBuilder('user')
            .leftJoinAndSelect("user.identities", "identity")
            .where(qb => {
                const subQuery = qb.subQuery()
                    .select("identity1.userId")
                    .from(DBIdentity, "identity1")
                    .where(`identity1.primaryEmail = :email`, { email: email })
                    .andWhere(`identity1.deleted != true`)
                    .getQuery();
                return `user.markedDeleted != true AND user.id IN ${subQuery}`
            });
        const result = await qBuilder.getMany();
        let order = (u1: User, u2: User) => u1.creationDate.localeCompare(u2.creationDate);
        if (result.length > 1) {
            const lastActivities = (await (await this.getEntityManager()).query(`
                SELECT ws.ownerId AS userId, MAX(wsi.creationTime) AS lastActivity FROM d_b_workspace_instance AS wsi
                LEFT JOIN d_b_workspace AS ws ON (wsi.workspaceId = ws.id)
                WHERE ws.ownerId IN (${result.map(u => `'${u.id}'`).join(", ")})
                GROUP BY ws.ownerId
            `)) as { userId?: string, lastActivity?: string }[];
            const lastActivity = (u: User) => lastActivities.filter(({ userId }) => userId === u.id).map(({ lastActivity }) => lastActivity)[0];
            order = (u1: User, u2: User) => {
                const a1 = lastActivity(u1) || u1.creationDate;
                const a2 = lastActivity(u2) || u2.creationDate;
                if (!a1 && !a2) return 0;
                if (!a1) return 1;
                if (!a2) return -1;
                return -1 * a1.localeCompare(a2);
            }
        }
        return result.sort(order);
    }

    public async findUserByGitpodToken(tokenHash: string, tokenType?: GitpodTokenType): Promise<{user: User, token: GitpodToken} | undefined> {
        const repo = await this.getGitpodTokenRepo();
        const qBuilder = repo.createQueryBuilder('gitpodToken')
            .leftJoinAndSelect("gitpodToken.user", "user");
        if (!!tokenType) {
            qBuilder.where("gitpodToken.tokenHash = :tokenHash AND gitpodToken.type = :tokenType", { tokenHash, tokenType });
        } else {
            qBuilder.where("gitpodToken.tokenHash = :tokenHash", { tokenHash });
        }
        qBuilder.andWhere("gitpodToken.deleted <> TRUE AND user.markedDeleted <> TRUE AND user.blocked <> TRUE");
        const token = await qBuilder.getOne();
        if (!token) {
            return;
        }

        return {user: token.user, token};
    }

    public async findAllGitpodTokensOfUser(userId: string): Promise<GitpodToken[]> {
        const repo = await this.getGitpodTokenRepo()
        const qBuilder = repo.createQueryBuilder('gitpodToken')
            .leftJoinAndSelect("gitpodToken.user", "user");
        qBuilder.where('user.id = :userId', { userId });
        return qBuilder.getMany();
    }

    public async storeGitpodToken(token: GitpodToken & { user: DBUser }): Promise<void> {
        const repo = await this.getGitpodTokenRepo();
        await repo.insert(token);
    }
    
    public async deleteGitpodToken(tokenHash: string): Promise<void> {
        const repo = await this.getGitpodTokenRepo();
        await repo.query(`
                UPDATE d_b_gitpod_token AS gt
                SET gt.deleted = TRUE
                WHERE tokenHash = ?;
            `, [tokenHash]);
    }

    public async deleteGitpodTokensNamedLike(userId: string, namePattern: string): Promise<void> {
        const repo = await this.getGitpodTokenRepo();
        await repo.query(`
            UPDATE d_b_gitpod_token AS gt
            SET gt.deleted = TRUE
            WHERE userId = ?
              AND name LIKE ?
        `, [userId, namePattern]);
    }

    public async findIdentitiesByName(identity: Identity): Promise<Identity[]> {
        const userRepo = await this.getIdentitiesRepo();
        const qBuilder = userRepo.createQueryBuilder('identity')
            .where(`identity.authProviderId = :authProviderId`, { authProviderId: identity.authProviderId })
            .andWhere(`identity.deleted != true`)
            .andWhere(`identity.authName = :authName`, { authName: identity.authName });
        return qBuilder.getMany();
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
            refreshable: !!token.refreshToken,
        };
        return await repo.save(entry);
    }

    public async findTokenEntryById(uid: string): Promise<TokenEntry | undefined> {
        const repo = await this.getTokenRepo();
        return repo.findOneById(uid);
    }

    public async deleteTokenEntryById(uid: string): Promise<void> {
        const repo = await this.getTokenRepo();
        await repo.deleteById(uid);
    }

    public async deleteExpiredTokenEntries(date: string): Promise<void> {
        const repo = await this.getTokenRepo();
        await repo.query(`
            UPDATE d_b_token_entry AS te
                SET te.deleted = TRUE
                WHERE te.expiryDate != ''
                    AND te.refreshable != 1
                    AND te.expiryDate <= ?;
            `, [date]);
    }

    public async updateTokenEntry(tokenEntry: Partial<TokenEntry> & Pick<TokenEntry, "uid">): Promise<void> {
        const repo = await this.getTokenRepo();
        await repo.updateById(tokenEntry.uid, tokenEntry);
    }

    public async deleteTokens(identity: Identity, shouldDelete?: (entry: TokenEntry) => boolean): Promise<void> {
        const existingTokens = await this.findTokensForIdentity(identity);
        const repo = await this.getTokenRepo();
        for (const existing of existingTokens) {
            if (!shouldDelete || shouldDelete(existing)) {
                existing.deleted = true;
                await repo.save(existing);
            }
        }
    }

    public async findTokenForIdentity(identity: Identity): Promise<Token | undefined> {
        const tokenEntries = await this.findTokensForIdentity(identity);
        if (tokenEntries.length > 1) {
            throw new Error(`Found more than one active token for ${identity.authProviderId} and user ${identity.authName}`);
        }
        if (tokenEntries.length === 0) {
            return undefined;
        }
        return tokenEntries[0].token;
    }

    public async findTokensForIdentity(identity: Identity, includeDeleted?: boolean): Promise<TokenEntry[]> {
        const repo = await this.getTokenRepo();
        const entry = await repo.find({ authProviderId: identity.authProviderId, authId: identity.authId });
        return entry.filter(te => includeDeleted || !te.deleted);
    }

    protected mapUserToDBUser(user: User): DBUser {
        const dbUser = user as DBUser;
        // Here we need to fill the pseudo column 'user' in DBIdentity (see there for details)
        dbUser.identities.forEach(id => id.user = dbUser);
        // TODO deprecated: Remove once we delete that column
        dbUser.identities.forEach(id => id.tokens = []);
        return dbUser;
    }

    public async getUserCount(excludeBuiltinUsers: boolean = true): Promise<number> {
        const userRepo = await this.getUserRepo();
        let query = `SELECT COUNT(1) AS cnt FROM d_b_user
            WHERE markedDeleted != true`;
        if (excludeBuiltinUsers) {
            query = `${query}
                AND name <> '${BUILTIN_WORKSPACE_PROBE_USER_NAME}'`
        }
        const res = await userRepo.query(query);
        const count = res[0].cnt;
        return count;
    }

    public async setEnvVar(envVar: UserEnvVar): Promise<void> {
        const repo = await this.getUserEnvVarRepo();
        await repo.save(envVar);
    }

    public async getEnvVars(userId: string): Promise<UserEnvVar[]> {
        const dbrepo = await this.getUserEnvVarRepo();
        const allVars = (await dbrepo.find({ where: { userId } }));
        return allVars.filter(envVar => !envVar.deleted);
    }

    public async deleteEnvVar(envVar: UserEnvVar): Promise<void> {
        envVar.deleted = true;
        const repo = await this.getUserEnvVarRepo();
        await repo.save(envVar);
    }

    public async findAllUsers(offset: number, limit: number, orderBy: keyof User, orderDir: "DESC" | "ASC", searchTerm?: string, minCreationDate?: Date, maxCreationDate?: Date, excludeBuiltinUsers?: boolean): Promise<{ total: number, rows: User[] }> {
        const userRepo = await this.getUserRepo();
        const qBuilder = userRepo.createQueryBuilder('user')
            .leftJoinAndSelect("user.identities", "identity");
        if (searchTerm) {
            qBuilder.andWhere(`user.name LIKE :searchTerm 
                OR user.fullName LIKE :searchTerm 
                OR user.id in (
                        SELECT userid from d_b_identity AS i WHERE 
                                i.deleted != true
                            AND i.primaryEmail LIKE :searchTerm
                )`, { searchTerm: '%' + searchTerm + '%' });
        }
        if (minCreationDate) {
            qBuilder.andWhere("user.creationDate >= :minCreationDate", { minCreationDate: minCreationDate.toISOString() });
        }
        if (maxCreationDate) {
            qBuilder.andWhere("user.creationDate < :maxCreationDate", { maxCreationDate: maxCreationDate.toISOString() });
        }
        if (excludeBuiltinUsers) {
            qBuilder.andWhere("user.name <> :username", { username: BUILTIN_WORKSPACE_PROBE_USER_NAME })
        }
        qBuilder.orderBy("user." + orderBy, orderDir);
        qBuilder.skip(offset).take(limit).select();
        const [rows, total] = await qBuilder.getManyAndCount();
        return { total, rows };
    }

    public async findUserByName(name: string): Promise<User | undefined> {
        return (await this.getUserRepo()).findOne({ name });
    }
}

export class TransactionalUserDBImpl extends TypeORMUserDBImpl {

    constructor(protected readonly manager: EntityManager) {
        super();
    }

    async getEntityManager(): Promise<EntityManager> {
        return this.manager;
    }
}

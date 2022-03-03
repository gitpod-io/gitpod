/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, EntityManager } from 'typeorm';
import { injectable, inject } from 'inversify';
import { TypeORM } from './typeorm';
import { AuthProviderEntry } from '@gitpod/gitpod-protocol';
import { AuthProviderEntryDB } from '../auth-provider-entry-db';
import { DBAuthProviderEntry } from './entity/db-auth-provider-entry';
import { DBIdentity } from './entity/db-identity';
import { createHash } from 'crypto';

@injectable()
export class AuthProviderEntryDBImpl implements AuthProviderEntryDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getAuthProviderRepo(): Promise<Repository<DBAuthProviderEntry>> {
        return (await this.getEntityManager()).getRepository(DBAuthProviderEntry);
    }
    async getIdentitiesRepo(): Promise<Repository<DBIdentity>> {
        return (await this.getEntityManager()).getRepository<DBIdentity>(DBIdentity);
    }

    async storeAuthProvider(ap: AuthProviderEntry, updateOAuthRevision: boolean): Promise<AuthProviderEntry> {
        const repo = await this.getAuthProviderRepo();
        if (updateOAuthRevision) {
            (ap.oauthRevision as any) = this.oauthContentHash(ap.oauth);
        }
        return repo.save(ap);
    }

    async delete({ id }: AuthProviderEntry): Promise<void> {
        // 1. virtually unlink identities using this provider from all users
        const identitiesRepo = await this.getIdentitiesRepo();
        await identitiesRepo.query(
            `UPDATE d_b_identity AS i
            SET i.deleted = TRUE
            WHERE i.authProviderId = ?;`,
            [id],
        );

        // 2. then mark as deleted
        const repo = await this.getAuthProviderRepo();
        await repo.update({ id }, { deleted: true });
    }

    async findAll(exceptOAuthRevisions: string[] = []): Promise<AuthProviderEntry[]> {
        exceptOAuthRevisions = exceptOAuthRevisions.filter((r) => r !== ''); // never filter out '' which means "undefined" in the DB

        const repo = await this.getAuthProviderRepo();
        let query = repo.createQueryBuilder('auth_provider').where('auth_provider.deleted != true');
        if (exceptOAuthRevisions.length > 0) {
            query = query.andWhere('auth_provider.oauthRevision NOT IN (:...exceptOAuthRevisions)', {
                exceptOAuthRevisions,
            });
        }
        return query.getMany();
    }

    async findAllHosts(): Promise<string[]> {
        const hostField: keyof DBAuthProviderEntry = 'host';

        const repo = await this.getAuthProviderRepo();
        const query = repo.createQueryBuilder('auth_provider').select(hostField).where('auth_provider.deleted != true');
        const result = (await query.execute()) as Pick<DBAuthProviderEntry, 'host'>[];
        return result.map((r) => r.host);
    }

    async findByHost(host: string): Promise<AuthProviderEntry | undefined> {
        const repo = await this.getAuthProviderRepo();
        const query = repo
            .createQueryBuilder('auth_provider')
            .where(`auth_provider.host = :host`, { host })
            .andWhere('auth_provider.deleted != true');
        return query.getOne();
    }

    async findByUserId(ownerId: string): Promise<AuthProviderEntry[]> {
        const repo = await this.getAuthProviderRepo();
        const query = repo
            .createQueryBuilder('auth_provider')
            .where(`auth_provider.ownerId = :ownerId`, { ownerId })
            .andWhere('auth_provider.deleted != true');
        return query.getMany();
    }

    protected oauthContentHash(oauth: AuthProviderEntry['oauth']): string {
        const result = createHash('sha256').update(JSON.stringify(oauth)).digest('hex');
        return result;
    }
}

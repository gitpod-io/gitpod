/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, EntityManager } from "typeorm";
import { injectable, inject } from "inversify";
import { TypeORM } from "./typeorm";
import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { AuthProviderEntryDB } from "../auth-provider-entry-db";
import { DBAuthProviderEntry } from "./entity/db-auth-provider-entry";
import { DBIdentity } from "./entity/db-identity";

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

    async storeAuthProvider(ap: AuthProviderEntry): Promise<AuthProviderEntry> {
        const repo = await this.getAuthProviderRepo();
        return repo.save(ap);
    }

    async delete({ id }: AuthProviderEntry): Promise<void> {
        // 1. virtually unlink identities using this provider from all users
        const identitiesRepo = await this.getIdentitiesRepo();
        await identitiesRepo.query(`UPDATE d_b_identity AS i
            SET i.deleted = TRUE
            WHERE i.authProviderId = ?;`, [ id ]);

        // 2. then mark as deleted
        const repo = await this.getAuthProviderRepo();
        await repo.update({ id }, { deleted: true });
    }

    async findAll(): Promise<AuthProviderEntry[]> {
        const repo = await this.getAuthProviderRepo();
        const query = repo.createQueryBuilder('auth_provider')
            .where('auth_provider.deleted != true');
        return query.getMany();
    }

    async findByHost(host: string): Promise<AuthProviderEntry | undefined> {
        const repo = await this.getAuthProviderRepo();
        const query = repo.createQueryBuilder('auth_provider')
            .where(`auth_provider.host = :host`, { host })
            .andWhere('auth_provider.deleted != true');
        return query.getOne();
    }

    async findByUserId(ownerId: string): Promise<AuthProviderEntry[]> {
        const repo = await this.getAuthProviderRepo();
        const query = repo.createQueryBuilder('auth_provider')
            .where(`auth_provider.ownerId = :ownerId`, { ownerId })
            .andWhere('auth_provider.deleted != true');
        return query.getMany();
    }

}

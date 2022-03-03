/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { EntityManager, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TypeORM } from './typeorm';
import { OneTimeSecretDB } from '../one-time-secret-db';
import { DBOneTimeSecret } from './entity/db-one-time-secret';

@injectable()
export class TypeORMOneTimeSecretDBImpl implements OneTimeSecretDB {
    @inject(TypeORM) protected readonly typeorm: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBOneTimeSecret>> {
        return await (await this.getEntityManager()).getRepository<DBOneTimeSecret>(DBOneTimeSecret);
    }

    public async register(secret: string, expirationTime: Date): Promise<string> {
        const s: DBOneTimeSecret = {
            deleted: false,
            expirationTime: expirationTime.toISOString(),
            id: uuidv4(),
            value: secret,
        };

        const repo = await this.getRepo();
        await repo.save(s);

        return s.id;
    }

    public async get(key: string): Promise<string | undefined> {
        const repo = await this.getRepo();
        const r = await repo.findOne(key);
        if (!r) {
            return undefined;
        }
        if (r.deleted) {
            return undefined;
        }

        r.deleted = true;
        await repo.save(r);

        if (r.expirationTime > new Date().toISOString()) {
            // secret has expired - return nothing
            return undefined;
        }

        return r.value;
    }

    public async remove(key: string): Promise<void> {
        const repo = await this.getRepo();
        await repo.delete(key);
    }

    public async pruneExpired(): Promise<void> {
        await (
            await this.getEntityManager()
        ).query('UPDATE d_b_one_time_secret SET deleted = 1 WHERE deleted = 0 AND expirationTime < NOW()');
    }
}

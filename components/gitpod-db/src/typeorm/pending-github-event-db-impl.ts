/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { PendingGithubEvent } from '@gitpod/gitpod-protocol';
import { EntityManager, Repository } from 'typeorm';
import { TypeORM } from './typeorm';
import {
    PendingGithubEventDB,
    PendingGithubEventWithUser,
    TransactionalPendingGithubEventDBFactory,
} from '../pending-github-event-db';
import { DBPendingGithubEvent } from './entity/db-pending-github-event';
import { DBIdentity } from './entity/db-identity';

@injectable()
export class TypeORMPendingGithubEventDBImpl implements PendingGithubEventDB {
    @inject(TypeORM) protected readonly typeorm: TypeORM;
    @inject(TransactionalPendingGithubEventDBFactory)
    protected readonly transactionalFactory: TransactionalPendingGithubEventDBFactory;

    protected async getManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBPendingGithubEvent>> {
        return await (await this.getManager()).getRepository<DBPendingGithubEvent>(DBPendingGithubEvent);
    }

    public async store(evt: PendingGithubEvent) {
        await (await this.getRepo()).save(evt);
    }

    public async findByGithubUserID(type: string, accountId: number): Promise<PendingGithubEvent[]> {
        const repo = await this.getRepo();
        return await repo
            .createQueryBuilder('pghe')
            .where(`pghe.githubUserId = :accountId AND pghe.type LIKE :tpe`, { accountId, tpe: `${type}%` })
            .getMany();
    }

    public async delete(evt: PendingGithubEvent) {
        // pending events is not synchronized via DB sync so we can delete it
        (await this.getRepo()).delete(evt.id);
    }

    public async findWithUser(type: string): Promise<PendingGithubEventWithUser[]> {
        const repo = await this.getRepo();
        const res = await repo
            .createQueryBuilder('pghe')
            .innerJoinAndMapOne('pghe.identity', DBIdentity, 'ident', 'pghe.githubUserId = ident.authId')
            .innerJoinAndSelect('ident.user', 'user')
            .where('ident.authProviderId = "Public-GitHub"')
            .andWhere(`ident.deleted != true`)
            .orderBy('pghe.creationDate', 'ASC')
            .getMany();

        return res as PendingGithubEventWithUser[];
    }

    async transaction<T>(code: (db: PendingGithubEventDB) => Promise<T>): Promise<T> {
        const manager = await this.getManager();
        return await manager.transaction(async (manager) => {
            const transactionalDB = this.transactionalFactory(manager);
            return await code(transactionalDB);
        });
    }
}

export class TransactionalPendingGithubEventDBImpl extends TypeORMPendingGithubEventDBImpl {
    constructor(protected readonly manager: EntityManager) {
        super();
    }

    protected async getManager() {
        return this.manager;
    }

    public async transaction<T>(code: (sb: PendingGithubEventDB) => Promise<T>): Promise<T> {
        return await code(this);
    }
}

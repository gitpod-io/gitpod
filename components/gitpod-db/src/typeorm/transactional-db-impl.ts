/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EntityManager } from "typeorm";
import { TypeORM } from "./typeorm";
import { inject } from "inversify";

export interface TransactionalDB<DB> {
    transaction<R>(code: (db: DB) => Promise<R>): Promise<R>;
}

export abstract class TransactionalDBImpl<DB> implements TransactionalDB<DB> {
    @inject(TypeORM) protected readonly typeorm: TypeORM;

    constructor(
        protected transactionalEM: EntityManager | undefined, // will be undefined when constructed with inversify, which is inteded
    ) {}

    protected async getEntityManager(): Promise<EntityManager> {
        if (this.transactionalEM) {
            return this.transactionalEM;
        }
        return (await this.typeorm.getConnection()).manager;
    }

    async transaction<R>(code: (db: DB) => Promise<R>): Promise<R> {
        const manager = await this.getEntityManager();
        return await manager.transaction(async (manager) => {
            return await code(this.createTransactionalDB(manager));
        });
    }

    // TODO(gpl) This feels unnecessary because we should already be able to create a new instance using inversify.
    // E.g. it could look like: transaction<R>(code: (db1: ..., db2...) => Promise<R>, ...serviceIdentifier: interfaces.ServiceIdentifier<DB>
    // But bc this requires some type shennenigans, and we're not sure we need it, we'll stick with this for now
    protected abstract createTransactionalDB(transactionalEM: EntityManager): DB;
}

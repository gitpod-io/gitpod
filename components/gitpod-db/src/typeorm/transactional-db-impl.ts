/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EntityManager } from "typeorm";
import { TypeORM } from "./typeorm";
import { inject, injectable, optional } from "inversify";

type TransactionalCode<DB, R> = (db: DB, txCtx: TransactionalContext) => Promise<R>;

export interface TransactionalDB<DB> {
    transaction<R>(txCtx: TransactionalContext | undefined, code: TransactionalCode<DB, R>): Promise<R>;
    transaction<R>(code: TransactionalCode<DB, R>): Promise<R>;
}

export class TransactionalContext {
    constructor(public readonly entityManager: EntityManager) {}
}

@injectable()
export abstract class TransactionalDBImpl<DB> implements TransactionalDB<DB> {
    constructor(
        @inject(TypeORM) protected readonly typeorm: TypeORM,
        @optional() private transactionalEM?: EntityManager,
    ) {}

    protected async getEntityManager(): Promise<EntityManager> {
        if (this.transactionalEM) {
            return this.transactionalEM;
        }
        return (await this.typeorm.getConnection()).manager;
    }

    async transaction<R>(txCtx: TransactionalContext | undefined, code: TransactionalCode<DB, R>): Promise<R>;
    async transaction<R>(code: TransactionalCode<DB, R>): Promise<R>;
    async transaction<R>(
        ctxOrCode: TransactionalContext | TransactionalCode<DB, R> | undefined,
        transactionalCode?: TransactionalCode<DB, R>,
    ): Promise<R> {
        let manager: EntityManager;
        if (ctxOrCode instanceof TransactionalContext) {
            manager = ctxOrCode.entityManager;
        } else {
            manager = await this.getEntityManager();
        }
        let code: TransactionalCode<DB, R>;
        if (typeof ctxOrCode === "function") {
            code = ctxOrCode;
        } else if (transactionalCode === undefined) {
            throw new Error("transactionalCode must be defined");
        } else {
            code = transactionalCode;
        }
        // we already have a transaction running. MYSQL does not support nested transactions, so we just run the code
        if (manager.queryRunner?.isTransactionActive) {
            return await code(this.createTransactionalDB(manager), new TransactionalContext(manager));
        }
        return await manager.transaction(async (manager) => {
            return await code(this.createTransactionalDB(manager), new TransactionalContext(manager));
        });
    }

    // TODO(gpl) This feels unnecessary because we should already be able to create a new instance using inversify.
    // E.g. it could look like: transaction<R>(code: (db1: ..., db2...) => Promise<R>, ...serviceIdentifier: interfaces.ServiceIdentifier<DB>
    // But bc this requires some type shennenigans, and we're not sure we need it, we'll stick with this for now
    protected abstract createTransactionalDB(transactionalEM: EntityManager): DB;
}

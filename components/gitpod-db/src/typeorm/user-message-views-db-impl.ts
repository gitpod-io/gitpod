/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, EntityManager } from 'typeorm';
import { injectable, inject } from 'inversify';
import { TypeORM } from './typeorm';
import { UserMessageViewsDB } from '../user-message-views-db';
import { DBUserMessageViewEntry } from './entity/db-user-message-view-entry';

@injectable()
export class TypeORMUserMessageViewsDBImpl implements UserMessageViewsDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getUserMessageViewsRepo(): Promise<Repository<DBUserMessageViewEntry>> {
        return (await this.getEntityManager()).getRepository(DBUserMessageViewEntry);
    }

    async didViewMessage(userId: string, userMessageId: string): Promise<boolean> {
        const repo = await this.getUserMessageViewsRepo();
        let query = repo
            .createQueryBuilder('view')
            .where('view.userMessageId = :userMessageId AND view.userId = :userId', {
                userId: userId,
                userMessageId: userMessageId,
            });
        const count = await query.getCount();
        return count > 0;
    }

    async markAsViewed(userId: string, messageIds: string[]): Promise<void> {
        const repo = await this.getUserMessageViewsRepo();
        const newEntries = messageIds.map((id) => {
            const newEntry = new DBUserMessageViewEntry();
            newEntry.userId = userId;
            newEntry.userMessageId = id;
            return newEntry;
        });
        await Promise.all(newEntries.map((entry) => repo.save(entry)));
    }
}

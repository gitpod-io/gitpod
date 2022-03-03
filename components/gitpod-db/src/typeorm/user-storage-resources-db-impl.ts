/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, EntityManager } from 'typeorm';
import { injectable, inject } from 'inversify';
import { TypeORM } from './typeorm';
import { UserStorageResourcesDB } from '../user-storage-resources-db';
import { DBUserStorageResource } from './entity/db-user-storage-resource';

@injectable()
export class TypeORMUserStorageResourcesDBImpl implements UserStorageResourcesDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getUserStorageResourceRepo(): Promise<Repository<DBUserStorageResource>> {
        return (await this.getEntityManager()).getRepository(DBUserStorageResource);
    }

    async get(userId: string, uri: string): Promise<string> {
        const resource = await this.getResource(userId, uri);
        const content = resource ? resource.content : '';
        return content;
    }

    async update(userId: string, uri: string, content: string): Promise<void> {
        // docs: https://dev.mysql.com/doc/refman/5.7/en/insert-on-duplicate.html
        const repo = await this.getUserStorageResourceRepo();
        await repo.query(
            `
            INSERT INTO d_b_user_storage_resource
                (userId, uri, content)
              VALUES
                (?, ?, ?)
              ON DUPLICATE KEY UPDATE
                content = VALUES(content);
          `,
            [userId, uri, content],
        );
    }

    async deleteAllForUser(userId: string): Promise<void> {
        const repo = await this.getUserStorageResourceRepo();
        await repo.update({ userId }, { deleted: true });
    }

    protected async getResource(userId: string, uri: string): Promise<DBUserStorageResource | undefined> {
        const repo = await this.getUserStorageResourceRepo();
        let query = repo
            .createQueryBuilder('resource')
            .where('resource.uri = :uri AND resource.userId = :userId', { userId: userId, uri: uri });
        const resource = await query.getOne();
        return resource;
    }
}

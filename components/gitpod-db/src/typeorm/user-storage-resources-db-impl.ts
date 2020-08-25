/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, EntityManager } from "typeorm";
import { injectable, inject } from "inversify";
import { TypeORM } from "./typeorm";
import { UserStorageResourcesDB } from "../user-storage-resources-db";
import { DBUserStorageResource } from "./entity/db-user-storage-resource";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

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
        const content = (resource) ? resource.content : "";
        return content;
    }

    async update(userId: string, uri: string, content: string): Promise<void> {
        const repo = await this.getUserStorageResourceRepo();
        let resource = await this.getResource(userId, uri);
        if (resource) {
            log.info({ userId }, 'updating resource', { uri });
            await repo.update(resource, { content });
        } else {
            log.info({ userId }, 'saving resource', { uri });
            resource = new DBUserStorageResource();
            resource.userId = userId;
            resource.uri = uri;
            resource.content = content;
            await repo.save(resource);
        }
    }

    async deleteAllForUser(userId: string): Promise<void> {
        const repo = await this.getUserStorageResourceRepo();
        await repo.update({ userId }, { deleted: true });
    }

    protected async getResource(userId: string, uri: string): Promise<DBUserStorageResource | undefined> {
        const repo = await this.getUserStorageResourceRepo();
        let query = repo.createQueryBuilder('resource')
            .where('resource.uri = :uri AND resource.userId = :userId', { userId: userId, uri: uri });
        const resource = await query.getOne();
        return resource;
    }

}

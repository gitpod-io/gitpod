/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, EntityManager } from "typeorm";
import { injectable, inject } from "inversify";
import { TypeORM } from "./typeorm";
import { TheiaPluginDB } from "../theia-plugin-db";
import { DBTheiaPlugin } from "./entity/db-theia-plugin";
import { TheiaPlugin } from "@gitpod/gitpod-protocol";
import { v4 as uuidv4 } from 'uuid';

@injectable()
export class TheiaPluginDBImpl implements TheiaPluginDB {

    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getTheiaPluginRepo(): Promise<Repository<DBTheiaPlugin>> {
        return (await this.getEntityManager()).getRepository(DBTheiaPlugin);
    }

    async newPlugin(userId: string, pluginName: string, bucketName: string, pathFn: (id: string) => string): Promise<TheiaPlugin> {
        const id = uuidv4();
        const newPlugin: TheiaPlugin = {
            id,
            pluginName,
            userId,
            bucketName,
            path: pathFn(id),
            state: TheiaPlugin.State.Uploading
        };
        return await this.storePlugin(newPlugin);
    }

    async storePlugin(plugin: TheiaPlugin): Promise<TheiaPlugin> {
        const repo = await this.getTheiaPluginRepo();
        return repo.save(plugin);
    }

    async delete(plugin: TheiaPlugin): Promise<void> {
        const repo = await this.getTheiaPluginRepo();
        await repo.delete(plugin);
    }

    async findById(id: string): Promise<TheiaPlugin | undefined> {
        const repo = await this.getTheiaPluginRepo();
        return repo.findOne(id);
    }

    async findByPluginId(pluginId: string): Promise<TheiaPlugin[]> {
        const repo = await this.getTheiaPluginRepo();
        const query = repo.createQueryBuilder('theia_plugin')
            .where(`theia_plugin.pluginId = :pluginId`, { pluginId });
        return query.getMany();
    }

    async exists(pluginId: string, predicate: { state?: TheiaPlugin.State, hash?: string }): Promise<boolean> {
        const repo = await this.getTheiaPluginRepo();
        const query = repo.createQueryBuilder('theia_plugin')
            .select('1')
            .where(`theia_plugin.pluginId = :pluginId`, { pluginId });
        if (predicate.state) {
            query.andWhere(`theia_plugin.state = :state`, { state: predicate.state })
        }
        if (predicate.hash) {
            query.andWhere(`theia_plugin.hash = :hash`, { hash: predicate.hash })
        }
        return (await query.getCount()) > 0;
    }

}

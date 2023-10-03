/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { EntityManager } from "typeorm";
import * as uuid from "uuid";
import {
    DBCodeSyncResource,
    IUserDataCollectionManifest,
    IUserDataManifest,
    IUserDataResourceManifest,
    ServerResource,
} from "./entity/db-code-sync-resource";
import { DBCodeSyncCollection } from "./entity/db-code-sync-collection";
import { TypeORM } from "./typeorm";

export interface CodeSyncInsertOptions {
    revLimit?: number;
    overwrite?: boolean;
}

@injectable()
export class CodeSyncResourceDB {
    @inject(TypeORM)
    private readonly typeORM: TypeORM;

    async getManifest(userId: string): Promise<IUserDataManifest | undefined> {
        const connection = await this.typeORM.getConnection();
        const resourcesResult = await connection.manager
            .createQueryBuilder(DBCodeSyncResource, "resource")
            .where(
                "resource.userId = :userId AND resource.kind != 'editSessions' AND resource.collection = :collection",
                {
                    userId,
                    collection: uuid.NIL,
                },
            )
            .andWhere((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select("resource2.userId")
                    .addSelect("resource2.kind")
                    .addSelect("max(resource2.created)")
                    .from(DBCodeSyncResource, "resource2")
                    .where(
                        "resource2.userId = :userId AND resource2.kind != 'editSessions' AND resource2.collection = :collection",
                        { userId, collection: uuid.NIL },
                    )
                    .groupBy("resource2.kind")
                    .orderBy("resource2.created", "DESC")
                    .getQuery();
                return "(resource.userId,resource.kind,resource.created) IN " + subQuery;
            })
            .getMany();
        const latest: IUserDataResourceManifest = Object.create(null);
        for (const resource of resourcesResult) {
            latest[resource.kind] = resource.rev;
        }

        const collectionsResult = await connection.manager
            .createQueryBuilder(DBCodeSyncResource, "resource")
            .where(
                "resource.userId = :userId AND resource.kind != 'editSessions' AND resource.collection != :collection",
                {
                    userId,
                    collection: uuid.NIL,
                },
            )
            .andWhere((qb) => {
                const subQuery = qb
                    .subQuery()
                    .select("resource2.userId")
                    .addSelect("resource2.kind")
                    .addSelect("resource2.collection")
                    .addSelect("max(resource2.created)")
                    .from(DBCodeSyncResource, "resource2")
                    .where(
                        "resource2.userId = :userId AND resource2.kind != 'editSessions' AND resource2.collection != :collection",
                        { userId, collection: uuid.NIL },
                    )
                    .groupBy("resource2.kind")
                    .addGroupBy("resource2.collection")
                    .orderBy("resource2.created", "DESC")
                    .getQuery();
                return "(resource.userId,resource.kind,resource.collection,resource.created) IN " + subQuery;
            })
            .getMany();

        const collections: IUserDataCollectionManifest = Object.create(null);
        for (const resource of collectionsResult) {
            if (!collections[resource.collection]) {
                collections[resource.collection] = { latest: Object.create(null) };
            }
            collections[resource.collection].latest![resource.kind] = resource.rev;
        }

        if (!resourcesResult.length && !collectionsResult.length) {
            return undefined;
        }

        let manifest: IUserDataManifest = { session: userId, latest };
        if (collectionsResult.length) {
            manifest = { session: userId, latest, collections };
        }
        return manifest;
    }

    async getResource(
        userId: string,
        kind: ServerResource,
        rev: string,
        collection: string | undefined,
    ): Promise<DBCodeSyncResource | undefined> {
        const connection = await this.typeORM.getConnection();
        return this.doGetResource(connection.manager, userId, kind, rev, collection);
    }

    async getResources(
        userId: string,
        kind: ServerResource,
        collection: string | undefined,
    ): Promise<DBCodeSyncResource[]> {
        const connection = await this.typeORM.getConnection();
        return this.doGetResources(connection.manager, userId, kind, collection);
    }

    async deleteSettingsSyncResources(userId: string, doDelete: () => Promise<void>): Promise<void> {
        const connection = await this.typeORM.getConnection();
        await connection.transaction(async (manager) => {
            await manager
                .createQueryBuilder()
                .delete()
                .from(DBCodeSyncResource)
                .where("userId = :userId AND kind != 'editSessions' AND collection = :collection", {
                    userId,
                    collection: uuid.NIL,
                })
                .execute();
            await doDelete();
        });
    }

    async deleteResource(
        userId: string,
        kind: ServerResource,
        rev: string | undefined,
        collection: string | undefined,
        doDelete: (rev?: string) => Promise<void>,
    ): Promise<void> {
        const connection = await this.typeORM.getConnection();
        if (rev) {
            await connection.transaction(async (manager) => {
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(DBCodeSyncResource)
                    .where("userId = :userId AND kind = :kind AND rev = :rev AND collection = :collection", {
                        userId,
                        kind,
                        rev,
                        collection: collection || uuid.NIL,
                    })
                    .execute();
                await doDelete(rev);
            });
        } else {
            await connection.transaction(async (manager) => {
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(DBCodeSyncResource)
                    .where("userId = :userId AND kind = :kind AND collection = :collection", {
                        userId,
                        kind,
                        collection: collection || uuid.NIL,
                    })
                    .execute();
                await doDelete();
            });
        }
    }

    async insert(
        userId: string,
        kind: ServerResource,
        collection: string | undefined,
        latestRev: string | undefined,
        doInsert: (rev: string, toDelete: string[]) => Promise<void>,
        params?: CodeSyncInsertOptions,
    ): Promise<string | undefined> {
        const connection = await this.typeORM.getConnection();
        return connection.transaction(async (manager) => {
            const resources = await this.doGetResources(manager, userId, kind, collection);
            const latest: DBCodeSyncResource | undefined = resources[0];
            let toDelete: DBCodeSyncResource[] = [];
            if (params?.revLimit && resources.length >= params.revLimit) {
                if (params.overwrite) {
                    toDelete = resources.slice(params.revLimit - 1);
                } else {
                    // resource limit met, cannot insert new resource
                    return undefined;
                }
            }

            // user setting always show with diff so we need to make sure it’s changed from prev revision
            if (latestRev && latestRev !== (latest?.rev ?? "0")) {
                return undefined;
            }

            const rev = uuid.v4();
            await manager
                .createQueryBuilder()
                .insert()
                .into(DBCodeSyncResource)
                .values({ userId, kind, rev, collection: collection || uuid.NIL })
                .execute();
            await doInsert(
                rev,
                toDelete.map((e) => e.rev),
            );

            return rev;
        });
    }

    private doGetResource(
        manager: EntityManager,
        userId: string,
        kind: ServerResource,
        rev: string,
        collection: string | undefined,
    ): Promise<DBCodeSyncResource | undefined> {
        if (rev === "latest") {
            return manager
                .createQueryBuilder(DBCodeSyncResource, "resource")
                .where("resource.userId = :userId AND resource.kind = :kind AND resource.collection = :collection", {
                    userId,
                    kind,
                    collection: collection || uuid.NIL,
                })
                .orderBy("resource.created", "DESC")
                .getOne();
        } else {
            return manager
                .createQueryBuilder(DBCodeSyncResource, "resource")
                .where("resource.userId = :userId AND resource.kind = :kind AND resource.collection = :collection", {
                    userId,
                    kind,
                    collection: collection || uuid.NIL,
                })
                .andWhere("resource.rev = :rev", { rev })
                .getOne();
        }
    }

    private doGetResources(
        manager: EntityManager,
        userId: string,
        kind: ServerResource,
        collection: string | undefined,
    ): Promise<DBCodeSyncResource[]> {
        return manager
            .getRepository(DBCodeSyncResource)
            .createQueryBuilder("resource")
            .where("resource.userId = :userId AND resource.kind = :kind AND resource.collection = :collection", {
                userId,
                kind,
                collection: collection || uuid.NIL,
            })
            .orderBy("resource.created", "DESC")
            .getMany();
    }

    async getCollections(userId: string): Promise<{ id: string }[]> {
        const connection = await this.typeORM.getConnection();
        const result = await connection.manager
            .createQueryBuilder(DBCodeSyncCollection, "collection")
            .where("collection.userId = :userId", { userId })
            .getMany();
        return result.map((r) => ({ id: r.collection }));
    }

    async isCollection(userId: string, collection: string): Promise<boolean> {
        const connection = await this.typeORM.getConnection();
        const result = await connection.manager
            .createQueryBuilder(DBCodeSyncCollection, "collection")
            .where("collection.userId = :userId AND collection.collection = :collection", {
                userId,
                collection,
            })
            .getOne();
        return !!result;
    }

    async createCollection(userId: string): Promise<string> {
        const connection = await this.typeORM.getConnection();
        return connection.transaction(async (manager) => {
            const collection = uuid.v4();
            await manager
                .createQueryBuilder()
                .insert()
                .into(DBCodeSyncCollection)
                .values({ userId, collection })
                .execute();
            return collection;
        });
    }

    async deleteCollection(
        userId: string,
        collection: string | undefined,
        doDelete: (collection?: string) => Promise<void>,
    ): Promise<void> {
        const connection = await this.typeORM.getConnection();
        if (collection) {
            // Delete a specific collection
            await connection.transaction(async (manager) => {
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(DBCodeSyncCollection)
                    .where("userId = :userId AND collection = :collection", { userId, collection })
                    .execute();
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(DBCodeSyncResource)
                    .where("userId = :userId AND collection = :collection", { userId, collection })
                    .execute();
                await doDelete(collection);
            });
        } else {
            // Delete all collections
            await connection.transaction(async (manager) => {
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(DBCodeSyncCollection)
                    .where("userId = :userId", { userId })
                    .execute();
                await manager
                    .createQueryBuilder()
                    .delete()
                    .from(DBCodeSyncResource)
                    .where("userId = :userId AND collection != :collection", { userId, collection: uuid.NIL })
                    .execute();
                await doDelete();
            });
        }
    }
}

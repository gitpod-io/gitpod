/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { EntityManager } from 'typeorm';
import uuid = require('uuid');
import { DBCodeSyncResource, IUserDataManifest, ServerResource } from './entity/db-code-sync-resource';
import { TypeORM } from './typeorm';

export interface CodeSyncInsertOptions {
  latestRev?: string;
  revLimit?: number;
}

@injectable()
export class CodeSyncResourceDB {
  @inject(TypeORM)
  private readonly typeORM: TypeORM;

  async getManifest(userId: string): Promise<IUserDataManifest> {
    const connection = await this.typeORM.getConnection();
    const resources = await connection.manager
      .createQueryBuilder(DBCodeSyncResource, 'resource')
      .where('resource.userId = :userId AND resource.deleted = 0', { userId })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('resource2.userId')
          .addSelect('resource2.kind')
          .addSelect('max(resource2.created)')
          .from(DBCodeSyncResource, 'resource2')
          .where('resource2.userId = :userId AND resource2.deleted = 0', { userId })
          .groupBy('resource2.kind')
          .orderBy('resource2.created', 'DESC')
          .getQuery();
        return '(resource.userId,resource.kind,resource.created) IN ' + subQuery;
      })
      .getMany();

    const latest: Record<ServerResource, string> = Object.create({});
    const manifest: IUserDataManifest = { session: userId, latest };
    for (const resource of resources) {
      latest[resource.kind] = resource.rev;
    }
    return manifest;
  }

  async getResource(userId: string, kind: ServerResource, rev: string): Promise<DBCodeSyncResource | undefined> {
    const connection = await this.typeORM.getConnection();
    return this.doGetResource(connection.manager, userId, kind, rev);
  }

  async getResources(userId: string, kind: ServerResource): Promise<DBCodeSyncResource[]> {
    const connection = await this.typeORM.getConnection();
    return this.doGetResources(connection.manager, userId, kind);
  }

  async delete(userId: string, doDelete: () => Promise<void>): Promise<void> {
    const connection = await this.typeORM.getConnection();
    await connection.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(DBCodeSyncResource)
        .set({ deleted: true })
        .where('userId = :userId AND deleted = 0', { userId })
        .execute();
      await doDelete();
    });
  }

  async insert(
    userId: string,
    kind: ServerResource,
    doInsert: (rev: string, oldRev?: string) => Promise<void>,
    params?: CodeSyncInsertOptions,
  ): Promise<string | undefined> {
    const connection = await this.typeORM.getConnection();
    return await connection.transaction(async (manager) => {
      let latest: DBCodeSyncResource | undefined;
      let toUpdated: DBCodeSyncResource | undefined;
      if (params?.revLimit) {
        const resources = await this.doGetResources(manager, userId, kind);
        latest = resources[0];
        if (resources.length >= params.revLimit) {
          toUpdated = resources[resources.length - 1];
        }
      } else {
        latest = await this.doGetResource(manager, userId, kind, 'latest');
      }
      if (params?.latestRev && latest?.rev !== params.latestRev) {
        return undefined;
      }
      const rev = uuid.v4();
      await doInsert(rev, toUpdated?.rev);
      if (toUpdated) {
        await manager
          .createQueryBuilder()
          .update(DBCodeSyncResource)
          .set({ rev })
          .where('userId = :userId AND kind = :kind AND rev = :rev', { userId, kind, rev: toUpdated.rev })
          .execute();
      } else {
        await manager.createQueryBuilder().insert().into(DBCodeSyncResource).values({ userId, kind, rev }).execute();
      }
      return rev;
    });
  }

  private doGetResource(
    manager: EntityManager,
    userId: string,
    kind: ServerResource,
    rev: string | 'latest',
  ): Promise<DBCodeSyncResource | undefined> {
    let qb = manager
      .createQueryBuilder(DBCodeSyncResource, 'resource')
      .where('resource.userId = :userId AND resource.kind = :kind AND resource.deleted = 0', { userId, kind });
    if (rev === 'latest') {
      qb.orderBy('resource.created', 'DESC');
    } else {
      qb = qb.andWhere('resource.rev = :rev', { rev });
    }
    return qb.getOne();
  }

  private doGetResources(manager: EntityManager, userId: string, kind: ServerResource): Promise<DBCodeSyncResource[]> {
    return manager
      .getRepository(DBCodeSyncResource)
      .createQueryBuilder('resource')
      .where('resource.userId = :userId AND resource.kind = :kind AND resource.deleted = 0', { userId, kind })
      .orderBy('resource.created', 'DESC')
      .getMany();
  }
}

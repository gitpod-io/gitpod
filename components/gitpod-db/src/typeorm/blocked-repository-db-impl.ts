/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { EntityManager, Repository } from "typeorm";
import { TypeORM } from "./typeorm";
import { DBBlockedRepository } from "./entity/db-blocked-repository";
import { BlockedRepositoryDB } from "../blocked-repository-db";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";

@injectable()
export class TypeORMBlockedRepositoryDBImpl implements BlockedRepositoryDB {
    @inject(TypeORM) protected readonly typeorm: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    async getBlockedRepositoryRepo(): Promise<Repository<DBBlockedRepository>> {
        return (await this.getEntityManager()).getRepository<DBBlockedRepository>(DBBlockedRepository);
    }

    public async createBlockedRepository(urlRegexp: string, blockUser: boolean): Promise<BlockedRepository> {
        const blockedRepositoryRepo = await this.getBlockedRepositoryRepo();

        return await blockedRepositoryRepo.save({ urlRegexp: urlRegexp, blockUser: blockUser, deleted: false });
    }

    public async deleteBlockedRepository(id: number): Promise<void> {
        const blockedRepositoryRepo = await this.getBlockedRepositoryRepo();

        await blockedRepositoryRepo.update(id, { deleted: true });
    }

    public async findAllBlockedRepositories(
        offset: number,
        limit: number,
        orderBy: keyof BlockedRepository,
        orderDir: "DESC" | "ASC",
        searchTerm?: string,
        minCreationDate?: Date,
        maxCreationDate?: Date,
    ): Promise<{ total: number; rows: BlockedRepository[] }> {
        const blockedRepositoryRepo = await this.getBlockedRepositoryRepo();

        const qBuilder = blockedRepositoryRepo.createQueryBuilder("br").where(`br.deleted = 0`);
        if (searchTerm) {
            qBuilder.andWhere(`br.urlRegexp LIKE :searchTerm`, { searchTerm: "%" + searchTerm + "%" });
        }
        if (minCreationDate) {
            qBuilder.andWhere("br.createdAt >= :minCreationDate", {
                minCreationDate: minCreationDate.toISOString(),
            });
        }
        if (maxCreationDate) {
            qBuilder.andWhere("br.createdAt < :maxCreationDate", {
                maxCreationDate: maxCreationDate.toISOString(),
            });
        }
        qBuilder.orderBy("br." + orderBy, orderDir);
        qBuilder.skip(offset).take(limit).select();
        const [rows, total] = await qBuilder.getManyAndCount();
        return { total, rows };
    }

    public async findBlockedRepositoryByURL(contextURL: string): Promise<BlockedRepository | undefined> {
        const blockedRepositoryRepo = await this.getBlockedRepositoryRepo();

        const query = blockedRepositoryRepo
            .createQueryBuilder("br")
            .where(":pattern REGEXP br.urlRegexp", { pattern: contextURL });

        return query.getOne();
    }
}

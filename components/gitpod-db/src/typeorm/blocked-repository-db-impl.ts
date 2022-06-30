/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { EntityManager, Repository } from "typeorm";
import { TypeORM } from "./typeorm";
import { DBBlockedRepository } from "./entity/db-blocked-repository";
import { BlockedRepositoryDB } from "../blocked-repository-db";
import { BlockedRepository } from "@gitpod/gitpod-protocol/src/blocked-repositories-protocol";

@injectable()
export class TypeORMBlockedRepositoryDBImpl implements BlockedRepositoryDB {
    @inject(TypeORM) protected readonly typeorm: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    async getBlockedRepositoryRepo(): Promise<Repository<DBBlockedRepository>> {
        return (await this.getEntityManager()).getRepository<DBBlockedRepository>(DBBlockedRepository);
    }

    public async findBlockedRepositoryByURL(contextURL: string): Promise<BlockedRepository | undefined> {
        const blockedRepositoryRepo = await this.getBlockedRepositoryRepo();

        const query = blockedRepositoryRepo
            .createQueryBuilder("br")
            .where(":pattern REGEXP br.urlRegexp", { pattern: contextURL });

        return query.getOne();
    }
}

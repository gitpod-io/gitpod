/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { Repository } from "typeorm";

import { CostCenter } from "@gitpod/gitpod-protocol";

import { CostCenterDB } from "../cost-center-db";
import { DBCostCenter } from "./entity/db-cost-center";
import { TypeORM } from "./typeorm";

@injectable()
export class CostCenterDBImpl implements CostCenterDB {
    @inject(TypeORM) protected readonly typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBCostCenter>> {
        return (await this.getEntityManager()).getRepository(DBCostCenter);
    }

    async storeEntry(ts: CostCenter): Promise<void> {
        const repo = await this.getRepo();
        await repo.save(ts);
    }

    async findById(id: string): Promise<CostCenter | undefined> {
        const repo = await this.getRepo();
        return repo.findOne(id);
    }
}

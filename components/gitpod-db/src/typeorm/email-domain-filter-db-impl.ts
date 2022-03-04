/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { EntityManager, Repository } from "typeorm";

import { EmailDomainFilterEntry } from "@gitpod/gitpod-protocol";
import { TypeORM } from "../typeorm/typeorm";
import { EmailDomainFilterDB } from "../email-domain-filter-db";
import { DBEmailDomainFilterEntry } from "./entity/db-email-domain-filter-entry";

@injectable()
export class EmailDomainFilterDBImpl implements EmailDomainFilterDB {

    @inject(TypeORM) typeorm: TypeORM;

    protected async getManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<EmailDomainFilterEntry>> {
        return await (await this.getManager()).getRepository<DBEmailDomainFilterEntry>(DBEmailDomainFilterEntry);
    }

    async storeFilterEntry(entry: EmailDomainFilterEntry): Promise<void> {
        const repo = await this.getRepo();
        await repo.save(entry);
    }

    async filter(domain: string): Promise<boolean> {
        const repo = await this.getRepo();
        const result = await repo.createQueryBuilder("entry")
            .where(`entry.domain = :domain`, { domain: domain })
            .andWhere(`entry.negative = '1'`)
            .getOne();
        return !result;
    }
}
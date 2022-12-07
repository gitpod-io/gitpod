/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { EntityManager, Repository } from "typeorm";

import { EduEmailDomain } from "@gitpod/gitpod-protocol";
import { TypeORM } from "./typeorm";
import { EduEmailDomainDB } from "../edu-email-domain-db";
import { DBEduEmailDomain } from "./entity/db-edu-email-domain";

@injectable()
export class EduEmailDomainDBImpl implements EduEmailDomainDB {
    @inject(TypeORM) typeorm: TypeORM;

    protected async getManager(): Promise<EntityManager> {
        return (await this.typeorm.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<EduEmailDomain>> {
        return await (await this.getManager()).getRepository<DBEduEmailDomain>(DBEduEmailDomain);
    }

    async storeDomainEntry(entry: EduEmailDomain): Promise<void> {
        const repo = await this.getRepo();
        await repo.save(entry);
    }

    async readEducationalInstitutionDomains(): Promise<EduEmailDomain[]> {
        const repo = await this.getRepo();
        const result = await repo.createQueryBuilder("entry").getMany();
        return result;
    }
}

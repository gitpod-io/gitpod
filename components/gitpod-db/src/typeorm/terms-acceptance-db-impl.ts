/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, EntityManager } from "typeorm";
import { injectable, inject } from "inversify";
import { TypeORM } from "./typeorm";
import { TermsAcceptanceEntry } from "@gitpod/gitpod-protocol";
import { TermsAcceptanceDB } from "../terms-acceptance-db";
import { DBTermsAcceptanceEntry } from "./entity/db-terms-acceptance-entry";

@injectable()
export class TermsAcceptanceDBImpl implements TermsAcceptanceDB {

    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager(): Promise<EntityManager> {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getTermsAcceptanceRepo(): Promise<Repository<DBTermsAcceptanceEntry>> {
        return (await this.getEntityManager()).getRepository(DBTermsAcceptanceEntry);
    }

    async getAcceptedRevision(userId: string): Promise<TermsAcceptanceEntry | undefined> {
        const repo = await this.getTermsAcceptanceRepo();
        const query = repo.createQueryBuilder(`terms_acceptance`)
            .where(`terms_acceptance.userId = :userId`, { userId });
        const result = await query.getMany();
        return result[0];
    }
    async updateAcceptedRevision(userId: string, termsRevision: string): Promise<void> {
        const repo = await this.getTermsAcceptanceRepo();
        await repo.save(<TermsAcceptanceEntry>{ userId, termsRevision, acceptionTime: new Date().toISOString() });
        // if entity does not exist in the database then inserts, otherwise updates.
    }

}

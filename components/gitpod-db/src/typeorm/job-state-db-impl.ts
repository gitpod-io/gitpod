/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Repository } from "typeorm";
import { DBJobState } from "./entity/db-job-state";
import { TypeORM } from "./typeorm";

@injectable()
export class JobStateDbImpl {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBJobState>> {
        return (await this.getEntityManager()).getRepository<DBJobState>(DBJobState);
    }

    public async setState(jobId: string, state: object): Promise<void> {
        const repo = await this.getRepo();
        let jobState = await this.getState(jobId);
        if (!jobState) {
            jobState = new DBJobState();
            jobState.jobId = jobId;
        }
        jobState.state = state;
        await repo.save(jobState);
    }

    public async getState(jobId: string): Promise<DBJobState | undefined> {
        const repo = await this.getRepo();
        return await repo.createQueryBuilder().where("jobId = :jobId", { jobId }).getOne();
    }
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { Repository } from "typeorm";

import { LicenseDB } from "../license-db";
import { TypeORM } from "./typeorm";
import { DBLicenseKey } from "./entity/db-license-key";

@injectable()
export class LicenseDBImpl implements LicenseDB {

    @inject(TypeORM) typeorm: TypeORM;

    protected async getRepo(): Promise<Repository<DBLicenseKey>> {
        const conn = await this.typeorm.getConnection();
        const repo = conn.manager.getRepository<DBLicenseKey>(DBLicenseKey);
        return repo;
    }

    public async store(id: string, key: string): Promise<void> {
        const dbobj: Partial<DBLicenseKey> = {
            id,
            key,
        };

        const repo = await this.getRepo();
        await repo.insert(dbobj);
    }

    async get(): Promise<string | undefined> {
        const repo = await this.getRepo();
        const dbobj = await repo.findOne({
            order: { installationTime: "DESC" }
        });
        if (!dbobj) {
            return;
        }

        return dbobj.key;
    }

}
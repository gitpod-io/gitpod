/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { InstallationAdmin, InstallationAdminSettings } from '@gitpod/gitpod-protocol';
import { Repository } from 'typeorm';
import { TypeORM } from './typeorm';
import { InstallationAdminDB } from '../installation-admin-db';
import { DBInstallationAdmin } from './entity/db-installation-admin';

@injectable()
export class TypeORMInstallationAdminImpl implements InstallationAdminDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async createDefaultRecord(): Promise<InstallationAdmin> {
        const record = InstallationAdmin.createDefault();

        const repo = await this.getInstallationAdminRepo();
        return repo.save(record);
    }

    async getInstallationAdminRepo(): Promise<Repository<DBInstallationAdmin>> {
        return (await this.getEntityManager()).getRepository<DBInstallationAdmin>(DBInstallationAdmin);
    }

    /**
     * Get Data
     *
     * Returns the first record found or creates a
     * new record.
     *
     * @returns Promise<InstallationAdmin>
     */
    async getData(): Promise<InstallationAdmin> {
        const repo = await this.getInstallationAdminRepo();
        const [record] = await repo.find();

        if (record) {
            return record;
        }

        /* Record not found - create one */
        return this.createDefaultRecord();
    }

    async setSettings(settings: InstallationAdminSettings): Promise<void> {
        const record = await this.getData();
        record.settings = {
            ...settings,
        };

        const repo = await this.getInstallationAdminRepo();
        await repo.save(record);
    }
}

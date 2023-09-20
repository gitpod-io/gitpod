/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject, optional } from "inversify";
import { EntityManager, Repository } from "typeorm";

import { TypeORM } from "./typeorm";
import { WebhookInstallationDB } from "../webhook-installation-db";
import { TransactionalDBImpl } from "./transactional-db-impl";
import { DBWebhookInstallation } from "./entity/db-webhook-installation";

@injectable()
export class WebhookInstallationDBImpl
    extends TransactionalDBImpl<WebhookInstallationDBImpl>
    implements WebhookInstallationDB
{
    constructor(@inject(TypeORM) private readonly typeORM: TypeORM, @optional() transactionalEM?: EntityManager) {
        super(typeORM, transactionalEM);
    }

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBWebhookInstallation>> {
        return (await this.getEntityManager()).getRepository(DBWebhookInstallation);
    }

    protected createTransactionalDB(transactionalEM: EntityManager): WebhookInstallationDBImpl {
        return new WebhookInstallationDBImpl(this.typeorm, transactionalEM);
    }

    async createInstallation(installation: DBWebhookInstallation): Promise<void> {
        const repo = await this.getRepo();
        await repo.save(installation);
    }
    async deleteInstallation(id: string): Promise<DBWebhookInstallation | undefined> {
        const repo = await this.getRepo();
        const before = await repo.findOne(id);
        await repo.delete(id);
        return before;
    }
    async findByProjectId(projectId: string): Promise<DBWebhookInstallation | undefined> {
        const repo = await this.getRepo();
        return repo.findOne({ projectId });
    }
}

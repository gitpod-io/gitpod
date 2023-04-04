/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Repository } from "typeorm";
import { LinkedInTokenDB } from "../linked-in-token-db";
import { DBLinkedInToken } from "./entity/db-linked-in-token";
import { TypeORM } from "./typeorm";

@injectable()
export class LinkedInTokenDBImpl implements LinkedInTokenDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBLinkedInToken>> {
        return (await this.getEntityManager()).getRepository<DBLinkedInToken>(DBLinkedInToken);
    }

    public async storeToken(userId: string, token: string): Promise<void> {
        const repo = await this.getRepo();
        const dbToken = new DBLinkedInToken();
        dbToken.userId = userId;
        dbToken.token = { token };
        await repo.save(dbToken);
    }
}

/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { TypeORM } from "./typeorm";
import { Repository } from "typeorm";
import { PersonalAccessTokenDB } from "../personal-access-token-db";
import { DBPersonalAccessToken } from "./entity/db-personal-access-token";

@injectable()
export class PersonalAccessTokenDBImpl implements PersonalAccessTokenDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBPersonalAccessToken>> {
        return (await this.getEntityManager()).getRepository<DBPersonalAccessToken>(DBPersonalAccessToken);
    }

    public async getByHash(hash: string): Promise<DBPersonalAccessToken> {
        throw new Error("unimplemented");
    }
}

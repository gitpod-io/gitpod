/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LinkedInProfile } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { LinkedInProfileDB } from "../linked-in-profile-db";
import { DBLinkedInProfile } from "./entity/db-linked-in-profile";
import { TypeORM } from "./typeorm";

@injectable()
export class LinkedInProfileDBImpl implements LinkedInProfileDB {
    @inject(TypeORM) typeORM: TypeORM;

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getRepo(): Promise<Repository<DBLinkedInProfile>> {
        return (await this.getEntityManager()).getRepository<DBLinkedInProfile>(DBLinkedInProfile);
    }

    public async storeProfile(userId: string, profile: LinkedInProfile): Promise<void> {
        const repo = await this.getRepo();
        // TODO(janx): check if profile with same LinkedIn ID already exists
        await repo.save({
            id: uuidv4(),
            userId,
            profile,
        });
    }
}

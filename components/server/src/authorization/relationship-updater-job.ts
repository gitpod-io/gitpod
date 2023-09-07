/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Job } from "../jobs/runner";
import { RelationshipUpdater } from "./relationship-updater";
import { TypeORM, UserDB } from "@gitpod/gitpod-db/lib";

@injectable()
export class RelationshipUpdateJob implements Job {
    constructor(
        @inject(RelationshipUpdater) private relationshipUpdater: RelationshipUpdater,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(TypeORM) private readonly db: TypeORM,
    ) {}

    public name = "relationship-update-job";
    public frequencyMs = 1000 * 60 * 60 * 1; // 1h

    public async run(): Promise<void> {
        try {
            const connection = await this.db.getConnection();
            const results = await connection.query(`
                SELECT id FROM d_b_user
                WHERE
                    (additionalData->"$.fgaRelationshipsVersion" != ${RelationshipUpdater.version} OR
                    additionalData->"$.fgaRelationshipsVersion" IS NULL) AND
                    markedDeleted = 0
                ORDER BY _lastModified DESC
                LIMIT 1000;`);
            const now = Date.now();
            for (const result of results) {
                const user = await this.userDB.findUserById(result.id);
                if (!user) {
                    continue;
                }
                try {
                    await this.relationshipUpdater.migrate(user);
                } catch (error) {
                    log.error(RelationshipUpdateJob.name + ": error running relationship update job", error);
                }
            }
            log.info(
                RelationshipUpdateJob.name + ": updated " + results.length + " users in " + (Date.now() - now) + "ms",
            );
        } catch (error) {
            log.error(RelationshipUpdateJob.name + ": error running relationship update job", error);
        }
    }
}

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Job } from "../jobs/runner";
import { RelationshipUpdater } from "./relationship-updater";
import { UserDB } from "@gitpod/gitpod-db/lib";

@injectable()
export class RelationshipUpdateJob implements Job {
    constructor(
        @inject(RelationshipUpdater) private relationshipUpdater: RelationshipUpdater,
        @inject(UserDB) private readonly userDB: UserDB,
    ) {}

    public name = "relationship-update-job";
    public frequencyMs = 1000 * 60 * 3; // 3m

    public async run(): Promise<number | undefined> {
        try {
            const ids = await this.userDB.findUserIdsNotYetMigratedToFgaVersion(RelationshipUpdater.version, 50);
            const now = Date.now();
            let migrated = 0;
            for (const userId of ids) {
                const user = await this.userDB.findUserById(userId);
                if (!user) {
                    continue;
                }
                try {
                    const resultingUser = await this.relationshipUpdater.migrate(user);
                    if (resultingUser.fgaRelationshipsVersion === RelationshipUpdater.version) {
                        migrated++;
                    }
                } catch (error) {
                    log.error(this.name + ": error running relationship update job", error);
                }
            }
            log.info(this.name + ": updated " + migrated + " users in " + (Date.now() - now) + "ms");
            return migrated;
        } catch (error) {
            log.error(this.name + ": error running relationship update job", error);
        }
    }
}

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";
import { Config } from "../config";
import { SpiceDBClient } from "../authorization/spicedb";

@injectable()
export class SpiceDBMigrationJob implements Job {
    @inject(SpiceDBClient) spicedbClient: SpiceDBClient;
    @inject(Config) protected readonly config: Config;

    public name = "spicedb";
    public frequencyMs = 5 * 60 * 1000; // every 5 minutes

    public async run(): Promise<void> {
        if (this.config.permissionsMigration.enabled) {
            log.info("spicedb-migrations: Job disabled.");
            return;
        }

        if (!this.spicedbClient) {
            log.info("spicedb-migrations: No client exists.");
            return;
        }

        log.info("spicedb-migrations: Would start migrations, but currently none defined.");
    }
}

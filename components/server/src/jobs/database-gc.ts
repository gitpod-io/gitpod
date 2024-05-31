/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PeriodicDbDeleter } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { Job } from "./runner";
import { Config } from "../config";

@injectable()
export class DatabaseGarbageCollector implements Job {
    @inject(PeriodicDbDeleter) protected readonly periodicDbDeleter: PeriodicDbDeleter;
    @inject(Config) protected readonly config: Config;

    public name = "database-gc";
    public frequencyMs = 30000; // every 30 seconds

    public async run(): Promise<number | undefined> {
        if (!this.config.runDbDeleter) {
            log.info("database-gc: deleter is disabled");
            return;
        }

        try {
            return await this.periodicDbDeleter.runOnce();
        } catch (err) {
            log.error("database-gc: error during run", err);
            throw err;
        }
    }
}

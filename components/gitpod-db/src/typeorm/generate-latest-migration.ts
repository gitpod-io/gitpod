/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationExecutor } from "typeorm";
import { writeFile } from "node:fs/promises";
import { Config } from "../config";
import { TypeORM } from "./typeorm";
import { join } from "node:path";

async function generateLatestMigrationName() {
    const config = new Config();
    const typeorm = new TypeORM(config, {});
    const conn = await typeorm.getConnection();
    const t = await new MigrationExecutor(conn).getAllMigrations();
    await writeFile(join(__dirname, "latest-migration.txt"), t.sort((m) => m.timestamp).pop()?.name ?? "");
    process.exit(0);
}

generateLatestMigrationName();

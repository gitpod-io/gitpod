/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Logger } from "typeorm";
import { importClassesFromDirectories } from "typeorm/util/DirectoryExportedClassesLoader";
import { writeFile } from "node:fs/promises";
import { TypeORM } from "./typeorm";
import { join } from "node:path";

const nopeLogger: Logger = {
    logQuery: function () {},
    logQueryError: function () {},
    logQuerySlow: function () {},
    logSchemaBuild: function () {},
    logMigration: function () {},
    log: function () {},
};

function getMigrationTimestamp(migrationClassName: string) {
    // https://github.com/typeorm/typeorm/blob/ff6e8751d98dfe9999ee21906cca7d20b1c6b15d/src/migration/MigrationExecutor.ts#L581-L584
    return parseInt(migrationClassName.substr(-13), 10);
}

async function generateLatestMigrationName() {
    const migrations =
        (TypeORM.defaultOptions(__dirname).migrations?.filter((e) => typeof e === "string") as string[]) ?? [];

    // https://github.com/typeorm/typeorm/blob/ff6e8751d98dfe9999ee21906cca7d20b1c6b15d/src/connection/ConnectionMetadataBuilder.ts#L38
    const classes = importClassesFromDirectories(nopeLogger, migrations);

    // TypeORM timestamp is the last 13 characters of the migration name
    // so if name not match the pattern, it's not a migration
    const regex = new RegExp("^.*?(\\d){13}$");
    const latest = classes
        .filter((e) => regex.test(e?.name ?? ""))
        .map((e) => ({ name: e.name, timestamp: getMigrationTimestamp(e.name) }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .pop();
    await writeFile(join(__dirname, "latest-migration.txt"), latest?.name ?? "");
    process.exit(0);
}

generateLatestMigrationName();

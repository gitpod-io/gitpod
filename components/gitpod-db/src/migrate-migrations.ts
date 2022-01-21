/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TypeORM } from './typeorm/typeorm';
import { Config } from './config';
import { MigrateMigrations0_2_0 } from './typeorm/migrate-migrations-0_2_0';

async function migrateMigrationsTable() {
  const config = new Config();
  const typeorm = new TypeORM(config, {});
  const conn = await typeorm.getConnection();

  const runner = conn.createQueryRunner();
  const migration_0_2_0 = new MigrateMigrations0_2_0();
  await migration_0_2_0.up(runner);

  conn.close();
  console.log("successfully migrated 'migrations' table.");
}

migrateMigrationsTable().catch((err) => {
  console.error(err);
  process.exit(1);
});

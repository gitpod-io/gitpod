/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class FixCollationMismatch1750344728596 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const versionRow = await queryRunner.query(`SELECT VERSION() as version`);
        const version = versionRow[0].version;

        // MySQL docs: https://dev.mysql.com/blog-archive/mysql-8-0-collations-migrating-from-older-collations/
        // 5.7 default: utf8mb4_general_ci
        // 8.0 default: utf8mb4_0900_ai_ci
        let collation: string;
        if (version.startsWith("5.7")) {
            collation = "utf8mb4_general_ci";
        } else {
            // Assume MySQL 8.0+ for all other versions
            collation = "utf8mb4_0900_ai_ci";
        }

        const dbNameRow = await queryRunner.query(`SELECT DATABASE() as dbName`);
        const dbName = dbNameRow[0].dbName;

        await queryRunner.query(`ALTER DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE ${collation};`);

        await queryRunner.query(`ALTER TABLE d_b_org_env_var DEFAULT CHARACTER SET utf8mb4 COLLATE ${collation};`);
        await queryRunner.query(`ALTER TABLE d_b_org_env_var CONVERT TO CHARACTER SET utf8mb4 COLLATE ${collation};`);

        await queryRunner.query(
            `ALTER TABLE d_b_workspace_instance_metrics DEFAULT CHARACTER SET utf8mb4 COLLATE ${collation};`,
        );
        await queryRunner.query(
            `ALTER TABLE d_b_workspace_instance_metrics CONVERT TO CHARACTER SET utf8mb4 COLLATE ${collation};`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // This migration is not reversible as it changes the database collation.
    }
}

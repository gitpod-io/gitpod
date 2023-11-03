/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_workspace_cluster";
const columnAWC = "availableWorkspaceClasses";
const columnPrefClass = "preferredWorkspaceClass";

export class WorkspaceClusterAvailableClasses1699012261520 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, columnAWC))) {
            await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${columnAWC} TEXT, ALGORITHM=INPLACE, LOCK=NONE`);
        }
        if (!(await columnExists(queryRunner, table, columnPrefClass))) {
            await queryRunner.query(
                `ALTER TABLE ${table} ADD COLUMN ${columnPrefClass} VARCHAR(100) NOT NULL DEFAULT '', ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, table, columnAWC)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${columnAWC}`);
        }
        if (await columnExists(queryRunner, table, columnPrefClass)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${columnPrefClass}`);
        }
    }
}

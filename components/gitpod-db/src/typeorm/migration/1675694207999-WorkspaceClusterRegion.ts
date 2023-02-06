/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_workspace_cluster";
const column = "region";

export class WorkspaceClusterRegion1675694207999 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, column))) {
            await queryRunner.query(
                `ALTER TABLE ${table} ADD COLUMN ${column} varchar(255) NOT NULL DEFAULT '', ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, table, column)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        }
    }
}

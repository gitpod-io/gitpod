/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, indexExists } from "./helper/helper";

const table = "d_b_workspace";
const column = "organizationId";
const orgIndex = "idx_organizationId";

export class WorkspaceOrganizationId1675744891502 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, column))) {
            await queryRunner.query(
                `ALTER TABLE ${table} ADD COLUMN ${column} varchar(36), ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }

        if (!(await indexExists(queryRunner, table, orgIndex))) {
            await queryRunner.query(`CREATE INDEX \`${orgIndex}\` ON \`${table}\` (${column})`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

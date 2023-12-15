/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_org_settings";
const columnMaxClass = "allowedWorkspaceClasses";

export class AddOrgSettingWorkspaceClass1701725025283 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, columnMaxClass))) {
            await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${columnMaxClass} JSON NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, table, columnMaxClass)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${columnMaxClass}`);
        }
    }
}

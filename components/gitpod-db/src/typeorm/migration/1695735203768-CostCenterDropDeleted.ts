/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

export class CostCenterDropDeleted1695735203768 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, "d_b_cost_center", "deleted")) {
            await queryRunner.query("ALTER TABLE `d_b_cost_center` DROP COLUMN `deleted`");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, "d_b_cost_center", "deleted"))) {
            await queryRunner.query(
                "ALTER TABLE `d_b_cost_center` ADD COLUMN `deleted` tinyint(4) NOT NULL DEFAULT '0'",
            );
        }
    }
}

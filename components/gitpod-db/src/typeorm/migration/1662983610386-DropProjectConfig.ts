/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const D_B_PROJECT = "d_b_project";
const COL_CONFIG = "config";

export class DropProjectConfig1662983610386 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, D_B_PROJECT, COL_CONFIG)) {
            await queryRunner.query(`ALTER TABLE ${D_B_PROJECT} DROP COLUMN ${COL_CONFIG}`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, D_B_PROJECT, COL_CONFIG))) {
            await queryRunner.query(`ALTER TABLE ${D_B_PROJECT} ADD COLUMN ${COL_CONFIG} text`);
        }
    }
}

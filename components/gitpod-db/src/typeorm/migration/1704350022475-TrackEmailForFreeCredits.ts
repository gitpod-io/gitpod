/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

export class TrackEmailForFreeCredits1704350022475 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = "d_b_free_credits";
        const column = "email";
        if (!(await columnExists(queryRunner, table, column))) {
            await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${column} varchar(255) NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

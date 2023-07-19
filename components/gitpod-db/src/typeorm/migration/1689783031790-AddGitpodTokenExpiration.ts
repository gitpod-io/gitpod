/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_gitpod_token";
const column = "expiryDate";

export class AddGitpodTokenExpiration1689783031790 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, column))) {
            await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${column} VARCHAR(255) NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE d_b_gitpod_token DROP COLUMN expiryDate`);
    }
}

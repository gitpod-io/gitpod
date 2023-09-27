/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const TABLE_NAME = "d_b_auth_provider_entry";
const COLUMN_NAME = "deleted";

export class AuthProviderEntryDropDeleted1695820658574 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME)) {
            await queryRunner.query(`ALTER TABLE \`${TABLE_NAME}\` DROP COLUMN \`${COLUMN_NAME}\`, ALGORITHM=INSTANT`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(
                `ALTER TABLE \`${TABLE_NAME}\` ADD COLUMN \`${COLUMN_NAME}\` tinyint(4) NOT NULL DEFAULT '0', ALGORITHM=INSTANT`,
            );
        }
    }
}

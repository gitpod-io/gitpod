/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_oidc_client_config";
const column = "verified";

export class AddVerifiedFlagToOIDCClientConfig1683791172567 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, column))) {
            await queryRunner.query(
                `ALTER TABLE ${table} ADD COLUMN ${column} tinyint(4) NOT NULL DEFAULT '0', ALGORITHM=INPLACE, LOCK=NONE`,
            );

            // In the app we require entries to be verified to allow activation.
            // This marks active entries as verified to maintain consistency.
            await queryRunner.query(`UPDATE ${table} SET ${column} = 1 where active = 1`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, table, column)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        }
    }
}

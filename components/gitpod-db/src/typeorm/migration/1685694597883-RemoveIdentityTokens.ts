/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_identity";
const column = "tokens";

export class RemoveIdentityTokens1685694597883 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, table, column)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // obsolete column, thus we don't need to recreate it
    }
}

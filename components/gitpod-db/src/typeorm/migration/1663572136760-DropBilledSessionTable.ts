/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class DropBilledSessionTable1663572136760 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_billed_session";
        if (await tableExists(queryRunner, TABLE_NAME)) {
            await queryRunner.query(`DROP TABLE \`${TABLE_NAME}\``);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const D_B_USER = "d_b_user";
const COL_PHONE_NUMBER = "verificationPhoneNumber";

export class IndexPhoneNumber1663784254956 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, D_B_USER, COL_PHONE_NUMBER))) {
            await queryRunner.query(
                `ALTER TABLE ${D_B_USER} ADD INDEX (${COL_PHONE_NUMBER}), ALGORITHM=INPLACE, LOCK=NONE `,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

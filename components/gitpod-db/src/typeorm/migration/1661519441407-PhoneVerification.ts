/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const D_B_USER = "d_b_user";
const COL_VERIFICATIONTIME = "lastVerificationTime";
const COL_PHONE_NUMBER = "verificationPhoneNumber";

export class PhoneVerification1661519441407 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, D_B_USER, COL_VERIFICATIONTIME))) {
            await queryRunner.query(
                `ALTER TABLE ${D_B_USER} ADD COLUMN ${COL_VERIFICATIONTIME} varchar(30) NOT NULL DEFAULT '', ALGORITHM=INPLACE, LOCK=NONE `,
            );
        }
        if (!(await columnExists(queryRunner, D_B_USER, COL_PHONE_NUMBER))) {
            await queryRunner.query(
                `ALTER TABLE ${D_B_USER} ADD COLUMN ${COL_PHONE_NUMBER} varchar(30) NOT NULL DEFAULT '', ALGORITHM=INPLACE, LOCK=NONE `,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

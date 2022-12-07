/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const D_B_COST_CENTER = "d_b_cost_center";
const COL_NEXT_BILLING_TIME = "nextBillingTime";

export class CostCenterNextBillingTime1663055856941 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, D_B_COST_CENTER, COL_NEXT_BILLING_TIME))) {
            await queryRunner.query(
                `ALTER TABLE ${D_B_COST_CENTER} ADD COLUMN ${COL_NEXT_BILLING_TIME} varchar(30) NOT NULL, ALGORITHM=INPLACE, LOCK=NONE `,
            );
            await queryRunner.query(
                `ALTER TABLE ${D_B_COST_CENTER} ADD INDEX(${COL_NEXT_BILLING_TIME}), ALGORITHM=INPLACE, LOCK=NONE `,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

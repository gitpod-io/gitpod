/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const D_B_COST_CENTER = "d_b_cost_center";
const COL_CREATION_TIME = "creationTime";
const COL_BILLING_STRATEGY = "billingStrategy";

export class CostCenterPaymentStrategy1662639748206 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, D_B_COST_CENTER, COL_CREATION_TIME))) {
            await queryRunner.query(
                `ALTER TABLE ${D_B_COST_CENTER} ADD COLUMN ${COL_CREATION_TIME} varchar(30) NOT NULL, ALGORITHM=INPLACE, LOCK=NONE `,
            );
            await queryRunner.query(
                `ALTER TABLE ${D_B_COST_CENTER} ADD COLUMN ${COL_BILLING_STRATEGY} varchar(255) NOT NULL DEFAULT 'other', ALGORITHM=INPLACE, LOCK=NONE `,
            );
            await queryRunner.query(
                `ALTER TABLE ${D_B_COST_CENTER} DROP PRIMARY KEY, ADD PRIMARY KEY(id, ${COL_CREATION_TIME}), ALGORITHM=INPLACE, LOCK=NONE `,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

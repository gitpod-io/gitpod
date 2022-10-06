/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";
import { indexExists } from "./helper/helper";

const D_B_COST_CENTER = "d_b_cost_center";
const COL_STRIPE_CUSTOMER_ID = "stripeCustomerId";

export class CostCenterAddColumnStripeCustomer1665058581369 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, D_B_COST_CENTER, COL_STRIPE_CUSTOMER_ID))) {
            await queryRunner.query(
                `ALTER TABLE ${D_B_COST_CENTER} ADD COLUMN ${COL_STRIPE_CUSTOMER_ID} varchar(60), ALGORITHM=INPLACE, LOCK=NONE `,
            );

            const INDEX_NAME = "IDX_stripe_customer_id";
            if (!(await indexExists(queryRunner, D_B_COST_CENTER, INDEX_NAME))) {
                await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${D_B_COST_CENTER} (${COL_STRIPE_CUSTOMER_ID})`);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

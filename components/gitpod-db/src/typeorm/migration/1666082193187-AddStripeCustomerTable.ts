/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class AddStripeCustomerTable1666082193187 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const exists = await tableExists(queryRunner, "d_b_stripe_customer");
        if (!exists) {
            await queryRunner.query(
                `CREATE TABLE IF NOT EXISTS \`d_b_stripe_customer\` (
                    \`stripe_customer_id\` char(255) NOT NULL,
                    \`attributionId\` char(255) NOT NULL,
                    \`creationTime\` varchar(255) NOT NULL,
                    \`deleted\` tinyint(4) NOT NULL DEFAULT '0',
                    \`_lastModified\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

                    INDEX \`ind_attribution_id\` (\`attributionId\`),
                    INDEX \`ind_dbsync\` (\`_lastModified\`),
                    PRIMARY KEY (\`stripe_customer_id\`)
                ) ENGINE=InnoDB`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

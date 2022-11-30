/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateToUBP1669370193752 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // migrate OSS users, the group by and having clause makes sure that we only add open-source users that are not on other plans as well.
        queryRunner.query(`
            INSERT INTO d_b_cost_center
                (id, spendingLimit, creationTime, billingStrategy, billingCycleStart, nextBillingTime)
                SELECT
                    CONCAT('user:', userId),
                    1000,
                    DATE_FORMAT(now(), '%Y-%m-%dT%TZ'),
                    'other',
                    DATE_FORMAT(now(), '%Y-%m-%dT%TZ'),
                    DATE_FORMAT(DATE_ADD(now(),INTERVAL 1 month), '%Y-%m-%dT%TZ')
                FROM d_b_subscription
                WHERE
                    cancellationDate=''
                    AND planId = 'free-open-source'
                    AND endDate=''
                    AND deleted=0
                GROUP BY userid;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

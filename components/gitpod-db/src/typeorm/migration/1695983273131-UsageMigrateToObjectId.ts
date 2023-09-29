/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class UsageMigrateToObjectId1695983273131 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1st step: migrate workspaceId to objectId
        await queryRunner.query(`UPDATE d_b_usage SET objectId = workspaceInstanceId WHERE kind = 'workspaceInstance'`);

        // 2nd step: migrate invoiceId to objectId. It's currently stored in the description; the pattern is: "Invoice %s finalized in Stripe"
        await queryRunner.query(
            `UPDATE d_b_usage SET objectId = SUBSTRING(description, 9, 36) WHERE kind = 'invoice' AND description LIKE 'Invoice % finalized in Stripe'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

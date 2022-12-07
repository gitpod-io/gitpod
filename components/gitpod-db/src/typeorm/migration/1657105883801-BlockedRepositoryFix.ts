/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class BlockedRepositoryFix1657105883801 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE d_b_blocked_repository MODIFY createdAt timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`,
        );
        await queryRunner.query(
            `ALTER TABLE d_b_blocked_repository MODIFY updatedAt timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

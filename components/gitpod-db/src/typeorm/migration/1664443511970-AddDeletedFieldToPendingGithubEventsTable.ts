/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeletedFieldToPendingGithubEventsTable1664443511970 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "ALTER TABLE d_b_pending_github_event ADD COLUMN `deleted` tinyint(4) NOT NULL DEFAULT '0'",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizationSettings1679909342076 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TABLE IF NOT EXISTS d_b_org_settings (orgId char(36) NOT NULL,  workspaceSharingDisabled tinyint(4) NOT NULL DEFAULT '0', createdAt timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updatedAt timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted tinyint(4) NOT NULL DEFAULT '0', PRIMARY KEY (orgId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS d_b_org_settings;");
    }
}

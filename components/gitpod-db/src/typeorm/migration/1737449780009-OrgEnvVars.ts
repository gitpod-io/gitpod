/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class OrgEnvVars1737449780009 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TABLE IF NOT EXISTS `d_b_org_env_var` (`id` char(36) NOT NULL, `orgId` char(36) NOT NULL, `name` varchar(255) NOT NULL, `value` text NOT NULL, `creationTime` varchar(36) NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`, `orgId`), KEY `ind_orgid` (orgId), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

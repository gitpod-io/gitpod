/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class ProjectEnvVars1639735838107 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_project_env_var` (`id` char(36) NOT NULL, `projectId` char(36) NOT NULL, `name` varchar(255) NOT NULL, `value` text NOT NULL, `censored` tinyint(4) NOT NULL, `creationTime` varchar(255) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`, `projectId`), KEY `ind_projectid` (projectId), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}

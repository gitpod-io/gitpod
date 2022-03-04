/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamsAndProjects1622468446118 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_team` (`id` char(36) NOT NULL, `name` varchar(255) NOT NULL, `slug` varchar(255) NOT NULL, `creationTime` varchar(255) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_team_membership` (`id` char(36) NOT NULL, `teamId` char(36) NOT NULL, `userId` char(36) NOT NULL, `role` varchar(255) NOT NULL, `creationTime` varchar(255) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `ind_teamId` (`teamId`), KEY `ind_userId` (`userId`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_project` (`id` char(36) NOT NULL, `name` varchar(255) NOT NULL, `cloneUrl` varchar(255) NOT NULL, `teamId` char(36) NOT NULL, `appInstallationId` varchar(255) NOT NULL, `creationTime` varchar(255) NOT NULL, `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `ind_teamId` (`teamId`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // this is a one-way idempotent 'migration', no rollback possible for a nonempty DB
    }

}

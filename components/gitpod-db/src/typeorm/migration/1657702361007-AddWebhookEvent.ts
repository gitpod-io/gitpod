/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWebhookEvent1657702361007 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TABLE IF NOT EXISTS `d_b_webhook_event` ( `id` char(36) NOT NULL, `creationTime` varchar(255) NOT NULL, `type` char(60) NOT NULL, `authorizedUserId` char(36) NULL, `status` char(60) NOT NULL, `message` text NULL, `rawEvent` text NOT NULL, `cloneUrl` char(255) NULL, `branch` char(255) NULL, `commit` varchar(255) NULL, `projectId` char(36) NULL, `prebuildStatus` char(60) NULL, `prebuildId` char(36) NULL, `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(`id`), KEY `ind_dbsync` (`_lastModified`), KEY `ind_cloneUrl` (`cloneUrl`), KEY `ind_status` (`status`), KEY `ind_prebuildStatus` (`prebuildStatus`), KEY `ind_prebuildId` (`prebuildId`), KEY `ind_creationTime` (`creationTime`) ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE `d_b_webhook_event`;");
    }
}

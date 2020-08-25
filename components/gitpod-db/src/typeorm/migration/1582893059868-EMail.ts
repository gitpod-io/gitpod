/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class EMail1582893059868 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_email` (`uid` char(36) NOT NULL, `type` varchar(30) NOT NULL, `notificationId` varchar(30) NOT NULL, `userId` char(36) NOT NULL, `recipientAddress` varchar(255) NOT NULL, `params` json NOT NULL, scheduledInternalTime varchar(255) NOT NULL, scheduledSendgridTime varchar(255) NOT NULL DEFAULT '', error varchar(255) NOT NULL DEFAULT '', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (uid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE INDEX `ind_scheduledSendgridTime` ON `d_b_email` (scheduledSendgridTime)");
        await queryRunner.query("CREATE INDEX `ind_type_notificationId_userId` ON `d_b_email` (type, notificationId, userId)");
        await queryRunner.query("CREATE INDEX `ind_lastModified` ON `d_b_email` (_lastModified)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE IF EXISTS `d_b_email`");
        await queryRunner.query("ALTER TABLE `d_b_email` DROP INDEX `ind_scheduledSendgridTime`");
        await queryRunner.query("ALTER TABLE `d_b_email` DROP INDEX `ind_type_notificationId_userId`");
        await queryRunner.query("ALTER TABLE `d_b_email` DROP INDEX `ind_lastModified`");
    }

}

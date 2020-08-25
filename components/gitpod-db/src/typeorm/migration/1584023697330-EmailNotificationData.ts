/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class EMailNotificationData1584023697330 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE INDEX `ind_planId` ON `d_b_subscription` (planId)");

        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_email_notification_data` (`type` varchar(30) NOT NULL, `notificationId` varchar(30) NOT NULL, `userId` char(36) NOT NULL, `done` tinyint(4) NOT NULL, `reevaluateAfter` varchar(255) NOT NULL, `data` json NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (type, notificationId, userId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE INDEX `ind_lastModified` ON `d_b_email_notification_data` (_lastModified)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP INDEX `ind_planId`");

        await queryRunner.query("DROP TABLE IF EXISTS `d_b_email_notification_data`");
        await queryRunner.query("ALTER TABLE `d_b_email_notification_data` DROP INDEX `ind_lastModified`");
    }

}

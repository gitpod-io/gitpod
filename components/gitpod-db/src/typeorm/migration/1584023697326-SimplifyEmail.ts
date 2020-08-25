/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class SimplifyEmail1584023697326 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_email` ADD `campaignId` varchar(30) NOT NULL");
        await queryRunner.query("UPDATE `d_b_email` SET campaignId = notificationId");

        await queryRunner.query("ALTER TABLE `d_b_email` DROP INDEX `ind_type_notificationId_userId`");
        await queryRunner.query("ALTER TABLE `d_b_email` DROP `type`");
        await queryRunner.query("ALTER TABLE `d_b_email` DROP `notificationId`");

        await queryRunner.query("CREATE INDEX `ind_campaignId_userId` ON `d_b_email` (campaignId, userId)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_email` ADD `type` varchar(30) NOT NULL");
        await queryRunner.query("ALTER TABLE `d_b_email` ADD `notificationId` varchar(30) NOT NULL")
        await queryRunner.query("UPDATE `d_b_email` SET notificationId = campaignId, type = 'campaign'");

        await queryRunner.query("ALTER TABLE `d_b_email` DROP INDEX `ind_campaignId_userId`");
        await queryRunner.query("ALTER TABLE `d_b_email` DROP `campaignId`");
        
        await queryRunner.query("CREATE INDEX `ind_type_notificationId_userId` ON `d_b_email` (type, notificationId, userId)");
    }

}

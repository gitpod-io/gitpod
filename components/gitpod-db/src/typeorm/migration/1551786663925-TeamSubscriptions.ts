/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class TeamSubscriptions1551786663925 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_team_subscription` (`id` varchar(255) NOT NULL, `userId` char(36) NOT NULL, `paymentReference` varchar(255) NOT NULL, `startDate` varchar(255) NOT NULL, `endDate` varchar(255) NOT NULL DEFAULT '', `planId` varchar(255) NOT NULL, `quantity` int(11) NOT NULL, `cancellationDate` varchar(255) NOT NULL DEFAULT '', `deleted` tinyint(4) NOT NULL DEFAULT 0, PRIMARY KEY(`id`)) ENGINE=InnoDB");
        await queryRunner.query("ALTER TABLE `d_b_team_subscription` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("CREATE INDEX `ind_user_paymentReference` ON `d_b_team_subscription`(`userId`, `paymentReference`)");
        await queryRunner.query("CREATE INDEX `ind_user_startDate` ON `d_b_team_subscription`(`userId`, `startDate`)");

        await queryRunner.query("ALTER TABLE `d_b_subscription` ADD `teamSubscriptionSlotId` char(255) NOT NULL DEFAULT ''");
        await queryRunner.query("CREATE TABLE `d_b_team_subscription_slot` ("
            + "`id` char(36) NOT NULL, "
            + "`teamSubscriptionId` char(36) NOT NULL, "
            + "`assigneeId` char(36) NOT NULL DEFAULT '', "
            + "`assigneeIdentifier` text, "
            + "`subscriptionId` char(36) NOT NULL DEFAULT '', "
            + "`cancellationDate` varchar(255) NOT NULL DEFAULT '', "
            + "PRIMARY KEY(`id`)) ENGINE=InnoDB");
        await queryRunner.query("ALTER TABLE `d_b_team_subscription_slot` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");

        await queryRunner.query("CREATE INDEX `ind_authProviderId_authName` ON `d_b_identity`(`authProviderId`, `authName`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_team_subscription`");
        await queryRunner.query("DROP TABLE `d_b_team_subscription_slot`");

        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP INDEX `ind_user_paymentReference`");
    }

}

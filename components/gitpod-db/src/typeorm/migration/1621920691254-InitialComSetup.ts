/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialComSetup1595232295133 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        // TODO: FIXME remove these test queries
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_account_entry` (`id` int(11) DEFAULT NULL, `userId` char(36) NOT NULL, `amount` double NOT NULL, `date` varchar(255) NOT NULL, `expiryDate` varchar(255) NOT NULL DEFAULT '', `kind` char(7) NOT NULL, `description` text, `uid` char(36) NOT NULL, `creditId` char(36) DEFAULT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`uid`), KEY `ind_dbsync` (`_lastModified`), KEY `ind_expiryDate` (`expiryDate`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_subscription` (`id` int(11) DEFAULT NULL, `userId` char(36) NOT NULL, `startDate` varchar(255) NOT NULL, `endDate` varchar(255) NOT NULL DEFAULT '', `amount` double NOT NULL, `uid` char(36) NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `planId` varchar(255) NOT NULL DEFAULT 'free', `paymentReference` varchar(255) NOT NULL DEFAULT '', `deleted` tinyint(4) NOT NULL DEFAULT '0', `cancellationDate` varchar(255) NOT NULL DEFAULT '', `paymentData` text, `teamSubscriptionSlotId` char(255) NOT NULL DEFAULT '', `firstMonthAmount` double DEFAULT NULL, PRIMARY KEY (`uid`), KEY `ind_user_paymentReference` (`userId`,`paymentReference`), KEY `ind_dbsync` (`_lastModified`), KEY `ind_planId` (`planId`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_subscription_additional_data` (`paymentReference` varchar(255) NOT NULL, `mrr` int(11) NOT NULL, `coupons` text, `lastInvoiceAmount` int(11) NOT NULL, `nextBilling` varchar(255) NOT NULL DEFAULT '', `lastInvoice` varchar(255) NOT NULL DEFAULT '', `lastUpdated` varchar(255) NOT NULL DEFAULT '', `lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`paymentReference`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_team_subscription` (`id` varchar(255) NOT NULL, `userId` char(36) NOT NULL, `paymentReference` varchar(255) NOT NULL, `startDate` varchar(255) NOT NULL, `endDate` varchar(255) NOT NULL DEFAULT '', `planId` varchar(255) NOT NULL, `quantity` int(11) NOT NULL, `cancellationDate` varchar(255) NOT NULL DEFAULT '', `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `ind_user_paymentReference` (`userId`,`paymentReference`), KEY `ind_user_startDate` (`userId`,`startDate`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_team_subscription_slot` (`id` char(36) NOT NULL, `teamSubscriptionId` char(36) NOT NULL, `assigneeId` char(36) NOT NULL DEFAULT '', `assigneeIdentifier` text, `subscriptionId` char(36) NOT NULL DEFAULT '', `cancellationDate` varchar(255) NOT NULL DEFAULT '', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `ind_tsid` (`teamSubscriptionId`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_edu_email_domain` (`domain` varchar(255) NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`domain`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_email_domain_filter` (`domain` varchar(255) NOT NULL, `negative` tinyint(4) NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`domain`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
        await queryRunner.query("CREATE TABLE IF NOT EXISTS `d_b_email` (`uid` char(36) NOT NULL, `userId` char(36) NOT NULL, `recipientAddress` varchar(255) NOT NULL, `params` json NOT NULL, `scheduledInternalTime` varchar(255) NOT NULL, `scheduledSendgridTime` varchar(255) NOT NULL DEFAULT '', `error` varchar(255) NOT NULL DEFAULT '', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `campaignId` varchar(30) NOT NULL, PRIMARY KEY (`uid`), KEY `ind_scheduledSendgridTime` (`scheduledSendgridTime`), KEY `ind_lastModified` (`_lastModified`), KEY `ind_campaignId_userId` (`campaignId`,`userId`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        // this is a one-way idempotent 'migration', no rollback possible for a nonempty DB
    }

}

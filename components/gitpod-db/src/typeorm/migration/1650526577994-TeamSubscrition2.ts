/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, tableExists } from "./helper/helper";

export class TeamSubscrition21650526577994 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TABLE IF NOT EXISTS `d_b_team_subscription2` (`id` char(36) NOT NULL, `teamId` char(36) NOT NULL, `paymentReference` varchar(255) NOT NULL, `startDate` varchar(255) NOT NULL, `endDate` varchar(255) NOT NULL DEFAULT '', `planId` varchar(255) NOT NULL, `quantity` int(11) NOT NULL, `cancellationDate` varchar(255) NOT NULL DEFAULT '', `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `ind_team_paymentReference` (`teamId`, `paymentReference`), KEY `ind_team_startDate` (`teamId`, `startDate`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
        );
        if (!(await columnExists(queryRunner, "d_b_subscription", "teamMembershipId"))) {
            await queryRunner.query(
                "ALTER TABLE `d_b_subscription` ADD COLUMN `teamMembershipId` char(36) NOT NULL DEFAULT ''",
            );
        }
        if (!(await columnExists(queryRunner, "d_b_team_membership", "subscriptionId"))) {
            await queryRunner.query(
                "ALTER TABLE `d_b_team_membership` ADD COLUMN `subscriptionId` char(36) NOT NULL DEFAULT ''",
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_team_subscription2")) {
            await queryRunner.query("DROP TABLE `d_b_team_subscription2`");
        }
        if (await columnExists(queryRunner, "d_b_subscription", "teamMembershipId")) {
            await queryRunner.query("ALTER TABLE `d_b_subscription` DROP COLUMN `teamMembershipId`");
        }
        if (await columnExists(queryRunner, "d_b_team_membership", "subscriptionId")) {
            await queryRunner.query("ALTER TABLE `d_b_team_membership` DROP COLUMN `subscriptionId`");
        }
    }
}

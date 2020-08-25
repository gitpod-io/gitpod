/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class SubscriptionDeletedCancellation1551786663924 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_subscription` ADD `deleted` tinyint(4) NOT NULL DEFAULT 0");
        await queryRunner.query("ALTER TABLE `d_b_subscription` ADD `cancellationDate` varchar(255) NOT NULL DEFAULT ''");
        await queryRunner.query("ALTER TABLE `d_b_subscription` ADD `paymentData` text");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP `deleted`");
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP `cancellationDate`");
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP `paymentData`");
    }

}

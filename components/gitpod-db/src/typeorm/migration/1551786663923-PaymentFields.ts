/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class PaymentFields1551786663923 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_subscription` ADD `planId` varchar(255) NOT NULL DEFAULT 'free'");
        await queryRunner.query("ALTER TABLE `d_b_subscription` ADD `paymentReference` varchar(255) NOT NULL DEFAULT ''");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP `planId`");
        await queryRunner.query("ALTER TABLE `d_b_subscription` DROP `paymentReference`");
    }

}

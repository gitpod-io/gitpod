/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class PaymentSource1583749304351 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE d_b_payment_source_info (
            id varchar(255) NOT NULL,
            resourceVersion bigint(13) NOT NULL,
            userId char(36) NOT NULL,
            status varchar(255) NOT NULL DEFAULT '',
            cardExpiryMonth int(11) NOT NULL,
            cardExpiryYear int(11) NOT NULL,
            softDeletedTime varchar(30) NOT NULL DEFAULT '',
            _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
            PRIMARY KEY (id, resourceVersion)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        await queryRunner.query("CREATE INDEX `ind_userId_softDeletedTime` ON `d_b_payment_source_info` (userId, softDeletedTime)");
        await queryRunner.query("CREATE INDEX `ind_resourceVersion` ON `d_b_payment_source_info` (resourceVersion)");
        await queryRunner.query("CREATE INDEX `ind_lastModified` ON `d_b_payment_source_info` (_lastModified)");

        await queryRunner.query("ALTER TABLE `d_b_subscription_additional_data` DROP cardExpiryMonth");
        await queryRunner.query("ALTER TABLE `d_b_subscription_additional_data` DROP cardExpiryYear");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_payment_source_info`");

        await queryRunner.query("ALTER TABLE `d_b_subscription_additional_data` ADD cardExpiryMonth int(11) NOT NULL");
        await queryRunner.query("ALTER TABLE `d_b_subscription_additional_data` ADD cardExpiryYear int(11) NOT NULL");
    }
}

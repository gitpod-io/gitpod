/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class AdditionalSubscriptionData1582634168297 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS d_b_subscription_additional_data (
                paymentReference varchar(255) NOT NULL PRIMARY KEY, 
                mrr int(11) NOT NULL,
                coupons text,
                cardExpiryMonth int(11) NOT NULL,
                cardExpiryYear int(11) NOT NULL,
                lastInvoiceAmount int(11) NOT NULL,
                nextBilling varchar(255) NOT NULL DEFAULT '', 
                lastInvoice varchar(255) NOT NULL DEFAULT '',
                lastUpdated varchar(255) NOT NULL DEFAULT ''
            ) ENGINE=InnoDB`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_subscription_additional_data`");
    }

}

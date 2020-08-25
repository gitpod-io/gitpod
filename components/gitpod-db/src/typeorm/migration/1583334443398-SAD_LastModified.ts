/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class SAD_LastModified1583334443398 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_subscription_additional_data` ADD `lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("UPDATE `d_b_subscription_additional_data` SET lastModified = DATE_FORMAT(STR_TO_DATE(lastUpdated, '%Y-%m-%dT%T.%fZ'), '%Y-%m-%d %T.%f')");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_subscription_additional_data` DROP `lastModified`");
    }

}

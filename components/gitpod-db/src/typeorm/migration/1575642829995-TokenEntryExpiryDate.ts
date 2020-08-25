/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class TokenEntryExpiryDate1575642829995 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE d_b_token_entry ADD COLUMN expiryDate varchar(255) NOT NULL DEFAULT ''");
        await queryRunner.query("CREATE INDEX `ind_expiryDate` ON `d_b_account_entry`(`expiryDate`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE d_b_account_entry DROP COLUMN expiryDate");
    }

}

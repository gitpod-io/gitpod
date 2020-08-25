/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { createIndexIfNotExist } from "./helper/helper";

export class TokenEntry_Refreshable1592203031937 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_token_entry` ADD `refreshable` tinyint(4) NOT NULL DEFAULT 0");
        await createIndexIfNotExist(queryRunner, 'd_b_token_entry', 'ind_expiryDate_refreshable', ['expiryDate', 'refreshable']);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_token_entry` DROP INDEX `ind_expiryDate_refreshable`");
        await queryRunner.query("ALTER TABLE `d_b_token_entry` DROP `refreshable`");
    }

}

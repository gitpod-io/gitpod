/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class UserStorageResourceContent1575358765224 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_user_storage_resource` MODIFY `content` LONGTEXT NOT NULL");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}

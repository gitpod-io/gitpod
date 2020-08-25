/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class DeleteIdentity1551358284441 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_identity` ADD `deleted` tinyint(4) NOT NULL DEFAULT 0");
        await queryRunner.query("ALTER TABLE `d_b_identity` DROP FOREIGN KEY fk_4fbd6b1f34072b95d03e7ae80eb");
        await queryRunner.query("ALTER TABLE `d_b_identity` DROP INDEX fk_4fbd6b1f34072b95d03e7ae80eb");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_identity` DROP `deleted`");
        await queryRunner.query("ALTER TABLE d_b_identity ADD CONSTRAINT fk_4fbd6b1f34072b95d03e7ae80eb FOREIGN KEY (userId) REFERENCES d_b_user(id)");
    }

}

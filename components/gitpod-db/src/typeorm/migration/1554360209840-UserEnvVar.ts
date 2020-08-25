/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class UserEnvVar1554360209840 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_user_env_var` (`id` CHAR(36) NOT NULL, `userId` CHAR(36) NOT NULL, `name` varchar(255) NOT NULL, `value` text NOT NULL, `repositoryPattern` varchar(255) NOT NULL DEFAULT '*/*', `deleted` tinyint(4) NOT NULL DEFAULT 0, PRIMARY KEY(`id`, `userId`)) ENGINE=InnoDB");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_user_env_var`");
    }

}
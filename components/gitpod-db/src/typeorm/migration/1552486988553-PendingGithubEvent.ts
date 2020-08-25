/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class PendingGithubEvent1552486988553 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_pending_github_event` (`id` char(36) NOT NULL, `githubUserId` varchar(36) NOT NULL, `creationDate` timestamp(6) NOT NULL, `type` varchar(128) NOT NULL, `event` TEXT, PRIMARY KEY(`id`)) ENGINE=InnoDB");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_pending_github_event`");
    }

}

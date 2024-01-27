/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class DropPendingGitHubEvents1681829127935 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE IF EXISTS `d_b_pending_github_event`");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS d_b_pending_github_event (  id char(36) NOT NULL,  githubUserId varchar(36) NOT NULL,  creationDate timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  type varchar(128) NOT NULL,  event text, deleted tinyint(4) NOT NULL DEFAULT '0',  PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        );
    }
}

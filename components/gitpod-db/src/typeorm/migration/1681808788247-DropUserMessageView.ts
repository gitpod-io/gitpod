/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUserMessageView1681808788247 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE IF EXISTS `d_b_user_message_view_entry`");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS d_b_user_message_view_entry (  id int(11) DEFAULT NULL,  userId varchar(255) NOT NULL,  userMessageId varchar(255) NOT NULL,  viewedAt timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (userId,userMessageId),  KEY ind_dbsync (viewedAt)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        );
    }
}

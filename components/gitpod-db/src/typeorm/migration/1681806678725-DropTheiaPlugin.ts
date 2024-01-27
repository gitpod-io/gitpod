/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTheiaPlugin1681806678725 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE IF EXISTS `d_b_theia_plugin`");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS d_b_theia_plugin (  id char(36) NOT NULL,  pluginName varchar(255) NOT NULL,  pluginId varchar(255) NOT NULL DEFAULT '',  userId char(36) NOT NULL DEFAULT '',  bucketName varchar(255) NOT NULL,  path varchar(255) NOT NULL,  hash varchar(255) DEFAULT NULL,  state char(25) NOT NULL,  _lastModified timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  PRIMARY KEY (id),  KEY ind_plugin_state_hash (pluginId,state,hash),  KEY ind_dbsync (_lastModified)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        );
    }
}

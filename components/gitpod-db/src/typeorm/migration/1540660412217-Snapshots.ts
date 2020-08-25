/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class Snapshots1540660412217 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_snapshot` (`id` char(36) NOT NULL, `creationTime` timestamp(6) NOT NULL, `originalWorkspaceId` char(36) NOT NULL, `bucketId` varchar(255) NOT NULL, `layoutData` MEDIUMTEXT, PRIMARY KEY(`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `d_b_layout_data` (`workspaceId` char(36) NOT NULL, `lastUpdatedTime` timestamp(6) NOT NULL, `layoutData` MEDIUMTEXT NOT NULL, PRIMARY KEY(`workspaceId`)) ENGINE=InnoDB");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_snapshot`");
        await queryRunner.query("DROP TABLE `d_b_layout_data`");
    }

}

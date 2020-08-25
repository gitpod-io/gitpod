/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class PrebuildWorkspaces1544182743616 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace` ADD `headless` tinyint(4) NOT NULL DEFAULT 0");
        await queryRunner.query("CREATE TABLE `d_b_prebuilt_workspace` (`id` char(36) NOT NULL, `cloneURL` varchar(255) NOT NULL, `commit` varchar(255) NOT NULL, `state` varchar(255) NOT NULL, `creationTime` timestamp(6) NOT NULL, `buildWorkspaceId` char(36) NOT NULL, `snapshot` varchar(255) NOT NULL DEFAULT '', `error` varchar(255) NOT NULL DEFAULT '', PRIMARY KEY(`id`)) ENGINE=InnoDB");
        await queryRunner.query("ALTER TABLE `d_b_prebuilt_workspace` ADD `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)");
        await queryRunner.query("CREATE INDEX `ind_ac4a9aece1a455da0dc653888f` ON `d_b_prebuilt_workspace`(`cloneURL`, `commit`)");
        await queryRunner.query("CREATE INDEX `ind_6a04b7005d5ad0e664725f9f17` ON `d_b_prebuilt_workspace`(`state`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_prebuilt_workspace` DROP INDEX `ind_6a04b7005d5ad0e664725f9f17`");
        await queryRunner.query("ALTER TABLE `d_b_prebuilt_workspace` DROP INDEX `ind_ac4a9aece1a455da0dc653888f`");
        await queryRunner.query("DROP TABLE `d_b_prebuilt_workspace`");
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP `headless`");
    }

}

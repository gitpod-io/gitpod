/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class PrebuiltWorkspaceUpdatable1551259814258 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_prebuilt_workspace_updatable` (`id` char(36) NOT NULL, `prebuiltWorkspaceId` char(36) NOT NULL, `owner` varchar(255) NOT NULL, `repo` varchar(255) NOT NULL, `isResolved` tinyint(4) NOT NULL, `installationId` varchar(255) NOT NULL, `checkId` varchar(255) NOT NULL DEFAULT '', `issue` varchar(255) NOT NULL DEFAULT '', `label` varchar(255) NOT NULL DEFAULT '', PRIMARY KEY(`id`)) ENGINE=InnoDB");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_prebuilt_workspace_updatable`");
    }

}

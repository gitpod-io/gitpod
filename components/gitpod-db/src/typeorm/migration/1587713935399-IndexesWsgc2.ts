/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { createIndexIfNotExist } from './helper/helper';

export class IndexesWsgc21587713935399 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await createIndexIfNotExist(queryRunner, 'd_b_prebuilt_workspace', 'ind_buildWorkspaceId', ['buildWorkspaceId']);
        await createIndexIfNotExist(queryRunner, 'd_b_workspace', 'ind_creationTime', ['creationTime']);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_prebuilt_workspace` DROP INDEX `ind_buildWorkspaceId`");
        await queryRunner.query("ALTER TABLE `d_b_workspace` DROP INDEX `ind_creationTime`");
    }

}

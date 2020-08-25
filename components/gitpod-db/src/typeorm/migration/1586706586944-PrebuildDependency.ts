/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { columnExists } from "./helper/helper";

export class PrebuildDependency1586706586944 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        if (!await columnExists(queryRunner, 'd_b_workspace', 'basedOnPrebuildId')) {
            await queryRunner.query("ALTER TABLE `gitpod`.`d_b_workspace` ADD `basedOnPrebuildId` char(36), ADD `basedOnSnapshotId` char(36)");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `gitpod`.`d_b_workspace` DROP `basedOnPrebuildId`, DROP `basedOnSnapshotId`");
    }

}
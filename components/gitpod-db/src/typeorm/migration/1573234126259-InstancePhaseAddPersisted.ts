/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class InstancePhaseAddPersisted1573234126259 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_workspace_instance` ADD `phasePersisted` char(32) NOT NULL DEFAULT ''");
        await queryRunner.query("CREATE INDEX `ind_phasePersisted` ON `d_b_workspace_instance`(`phasePersisted`)");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}

/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class WsiPhasePersisted1573483250702 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("UPDATE d_b_workspace_instance as wsi SET wsi.phasePersisted = IFNULL(wsi.status->>'$.phase', 'stopped') WHERE wsi.phasePersisted = '';");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}

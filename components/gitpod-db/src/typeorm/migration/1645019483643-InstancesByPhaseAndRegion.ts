/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { indexExists } from './helper/helper';

const TABLE_NAME = 'd_b_workspace_instance';
const INDEX_NAME = 'ind_phasePersisted_region';

export class InstancesByPhaseAndRegion1645019483643 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (phasePersisted, region)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists } from './helper/helper';

export class ProjectConfiguration1626853418369 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (!(await columnExists(queryRunner, 'd_b_project', 'config'))) {
            await queryRunner.query('ALTER TABLE d_b_project ADD COLUMN config text');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}

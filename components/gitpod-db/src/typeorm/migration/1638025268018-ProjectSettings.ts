/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists } from './helper/helper';

export class ProjectSettings1638025268018 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, 'd_b_project', 'settings'))) {
            await queryRunner.query('ALTER TABLE d_b_project ADD COLUMN `settings` text NULL');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists } from './helper/helper';

export class UserProjects1627287775965 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (!(await columnExists(queryRunner, 'd_b_project', 'userId'))) {
            await queryRunner.query('ALTER TABLE d_b_project MODIFY COLUMN `teamId` char(36) NULL');
            await queryRunner.query('ALTER TABLE d_b_project ADD COLUMN `userId` char(36) NULL');
            await queryRunner.query('CREATE INDEX `ind_userId` ON `d_b_project` (userId)');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}

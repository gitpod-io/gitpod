/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { tableExists, columnExists, indexExists } from './helper/helper';

export class AddProjectIdToPrebuiltWorkspace1626351957505 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    if (await tableExists(queryRunner, 'd_b_prebuilt_workspace')) {
      if (!(await columnExists(queryRunner, 'd_b_prebuilt_workspace', 'projectId'))) {
        await queryRunner.query(
          'ALTER TABLE d_b_prebuilt_workspace ADD COLUMN `projectId` char(36) DEFAULT NULL, ADD COLUMN `branch` varchar(255) DEFAULT NULL',
        );
      }
    }
    if (!(await indexExists(queryRunner, 'd_b_project', 'cloneUrl'))) {
      await queryRunner.query('CREATE INDEX `ind_cloneUrl` ON `d_b_project` (cloneUrl)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<any> {}
}

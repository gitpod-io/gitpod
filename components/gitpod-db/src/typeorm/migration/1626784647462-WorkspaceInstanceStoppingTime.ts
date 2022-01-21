/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists, tableExists } from './helper/helper';

export class WorkspaceInstanceStoppingTime1626784647462 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    if (await tableExists(queryRunner, 'd_b_workspace_instance')) {
      if (!(await columnExists(queryRunner, 'd_b_workspace_instance', 'stoppingTime'))) {
        await queryRunner.query(
          "ALTER TABLE d_b_workspace_instance ADD COLUMN stoppingTime varchar(255) NOT NULL DEFAULT ''",
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<any> {}
}

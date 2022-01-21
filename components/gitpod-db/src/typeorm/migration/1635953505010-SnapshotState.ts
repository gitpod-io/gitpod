/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists, indexExists } from './helper/helper';

const TABLE_NAME = 'd_b_snapshot';
const INDEX_NAME = 'ind_state';

export class SnapshotState1635953505010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    if (!(await columnExists(queryRunner, TABLE_NAME, 'availableTime'))) {
      await queryRunner.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN availableTime varchar(255) NOT NULL DEFAULT ''`);
    }
    if (!(await columnExists(queryRunner, TABLE_NAME, 'state'))) {
      await queryRunner.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN state char(32) NOT NULL DEFAULT 'available'`);
    }
    await queryRunner.query(`UPDATE ${TABLE_NAME} SET state = 'available' WHERE state = ''`);

    if (!(await columnExists(queryRunner, TABLE_NAME, 'message'))) {
      await queryRunner.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN message varchar(255) NOT NULL DEFAULT ''`);
    }

    if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
      await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (state)`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN availableTime`);
    await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN state`);
    await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN message`);
    await queryRunner.query(`DROP INDEX ${INDEX_NAME} ON ${TABLE_NAME}`);
  }
}

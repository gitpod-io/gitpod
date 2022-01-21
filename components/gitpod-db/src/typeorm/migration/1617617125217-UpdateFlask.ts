/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateFlask1617617125217 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    const toDelete = ['https://github.com/breatheco-de/python-flask-api-tutorial'];
    const newEntries = [
      {
        url: 'https://github.com/gitpod-io/python-flask-example',
        description: 'The official example from Flask',
        priority: 40,
      },
    ];
    // delete old entries
    await queryRunner.query(
      `DELETE FROM d_b_repository_white_list where url in (${toDelete.map((e) => '?').join(', ')})`,
      toDelete,
    );
    const insert = `INSERT IGNORE INTO d_b_repository_white_list (url, description, priority) VALUES ${newEntries
      .map((e) => '(?, ?, ?)')
      .join(', ')}`;
    const values: any[] = [];
    for (const e of newEntries) {
      values.push(e.url, e.description, e.priority);
    }
    await queryRunner.query(insert, values);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {}
}

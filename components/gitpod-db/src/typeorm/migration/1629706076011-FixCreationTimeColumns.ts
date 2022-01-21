/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCreationTimeColumns1629706076011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      'ALTER TABLE d_b_app_installation MODIFY creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);',
    );
    await queryRunner.query(
      'ALTER TABLE d_b_prebuilt_workspace MODIFY creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);',
    );
    await queryRunner.query(
      'ALTER TABLE d_b_snapshot MODIFY creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {}
}

/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists } from './helper/helper';

export class ReplaceStringBooleansWithBooleans1632224603256 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    if (await columnExists(queryRunner, 'd_b_user', 'additionalData')) {
      await queryRunner.query(
        "update d_b_user set additionalData = json_set(additionalData, '$.emailNotificationSettings.allowsChangelogMail', true) where json_extract(additionalData, '$.emailNotificationSettings.allowsChangelogMail') = 'true'",
      );
      await queryRunner.query(
        "update d_b_user set additionalData = json_set(additionalData, '$.emailNotificationSettings.allowsChangelogMail', false) where json_extract(additionalData, '$.emailNotificationSettings.allowsChangelogMail') = 'false'",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<any> {}
}

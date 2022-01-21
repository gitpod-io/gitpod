/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamsMembershipInvite1623652164639 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      "CREATE TABLE IF NOT EXISTS `d_b_team_membership_invite` (`id` char(36) NOT NULL, `teamId` char(36) NOT NULL, `role` varchar(255) NOT NULL, `creationTime` varchar(255) NOT NULL, `invalidationTime` varchar(255) NOT NULL DEFAULT '', `invitedEmail` varchar(255) NOT NULL DEFAULT '', `deleted` tinyint(4) NOT NULL DEFAULT '0', `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `ind_teamId` (`teamId`), KEY `ind_dbsync` (`_lastModified`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    // this is a one-way idempotent 'migration', no rollback possible for a nonempty DB
  }
}

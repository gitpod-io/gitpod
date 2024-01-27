/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class VolumeSnapshotCreation1651188368768 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS d_b_volume_snapshot (  id char(36) NOT NULL, creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),  originalWorkspaceId char(36) NOT NULL, volumeHandle varchar(255) NOT NULL, PRIMARY KEY (id),  KEY ind_originalWorkspaceId (originalWorkspaceId),  KEY ind_dbsync (creationTime)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { tableExists } from "./helper/helper";

export class VolumeSnapshotAddWSId1654628106102 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, "d_b_volume_snapshot")) {
            await queryRunner.query("DROP TABLE `d_b_volume_snapshot`");
        }
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS d_b_volume_snapshot (  id char(36) NOT NULL, workspaceId char(36) NOT NULL, creationTime timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), volumeHandle varchar(255) NOT NULL, PRIMARY KEY (id), KEY ind_5iziusbz752p4jv3e8erq3wc7n (workspaceId), KEY ind_dbsync (creationTime)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

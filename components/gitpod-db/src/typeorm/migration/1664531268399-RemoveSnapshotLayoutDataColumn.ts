/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSnapshotLayoutDataColumn1664531268399 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE d_b_snapshot DROP COLUMN layoutData`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

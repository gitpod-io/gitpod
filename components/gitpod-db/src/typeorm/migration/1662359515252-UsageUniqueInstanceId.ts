/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class UsageUniqueInstanceId1662359515252 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`alter table d_b_usage add UNIQUE (workspaceInstanceId)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

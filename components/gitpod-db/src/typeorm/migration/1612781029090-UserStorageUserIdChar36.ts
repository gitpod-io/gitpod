/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserStorageUserIdChar1612781029090 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query('ALTER TABLE d_b_user_storage_resource MODIFY userId char(36);');
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}

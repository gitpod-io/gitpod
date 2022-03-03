/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropDBPaymentSourceInfo1641287965022 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query('DROP TABLE `d_b_payment_source_info`');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { tableExists } from './helper/helper';

export class LicenseDB1593167873419 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            'CREATE TABLE IF NOT EXISTS `d_b_license_key` (`id` char(36) NOT NULL, `installationTime` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `key` text NOT NULL, PRIMARY KEY(`id`)) ENGINE=InnoDB',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, 'd_b_license_key')) {
            await queryRunner.query('DROP TABLE `d_b_license_key`');
        }
    }
}

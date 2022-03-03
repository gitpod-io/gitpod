/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { indexExists } from './helper/helper';

export class IndexTokenEntryExpiryDate1637586292251 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = 'd_b_token_entry';
        const INDEX_NAME = 'ind_expiryDate';

        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (expiryDate)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

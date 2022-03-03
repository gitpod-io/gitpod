/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists, tableExists } from './migration/helper/helper';

/**
 * This is a migration that is necessary due to our switch from typeorm 0.1.x to 0.2.x.
 * As this affects the migration process itself, we cannot use it to fix itself. Instead, we add another
 * entrypoint that triggers this "meta-migration", which re-uses the common migration interface.
 */
export class MigrateMigrations0_2_0 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, 'migrations')) {
            const idColumnExists = await columnExists(queryRunner, 'migrations', 'id');
            if (!idColumnExists) {
                await queryRunner.query(`ALTER TABLE migrations ADD COLUMN id int(11) NOT NULL;`);
                await queryRunner.query(`SET @next_id := 0;`);
                await queryRunner.query(`UPDATE migrations SET id = @next_id := @next_id + 1 ORDER BY timestamp ASC;`);
                await queryRunner.query(`ALTER TABLE migrations DROP PRIMARY KEY;`);
                await queryRunner.query(`ALTER TABLE migrations ADD PRIMARY KEY (id);`);
                await queryRunner.query(`ALTER TABLE migrations MODIFY COLUMN id int(11) NOT NULL AUTO_INCREMENT;`);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        if (await tableExists(queryRunner, 'migrations')) {
            const idColumnExists = await columnExists(queryRunner, 'migrations', 'id');
            if (idColumnExists) {
                await queryRunner.query(`ALTER TABLE migrations MODIFY COLUMN id int(11);`);
                await queryRunner.query(`ALTER TABLE migrations DROP PRIMARY KEY;`);
                await queryRunner.query(`ALTER TABLE migrations ADD PRIMARY KEY (timestamp);`);
                await queryRunner.query(`ALTER TABLE migrations DROP COLUMN id;`);
            }
        }
    }
}

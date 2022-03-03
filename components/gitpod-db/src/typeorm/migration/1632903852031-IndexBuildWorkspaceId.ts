/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';
import { indexExists } from './helper/helper';

const INDEX_NAME = 'ind_buildWorkspaceId';
const TABLE_NAME = 'd_b_prebuilt_workspace';

export class IndexBuildWorkspaceId1632903852031 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (buildWorkspaceId)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX ${INDEX_NAME} ON ${TABLE_NAME}`);
    }
}

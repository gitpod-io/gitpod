/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { indexExists } from "./helper/helper";

export class IndexWorkspaceGCQueries1637587650752 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const TABLE_NAME = "d_b_workspace";
        const CREATION_TIME_INDEX_NAME = "ind_creationTime";
        if (!(await indexExists(queryRunner, TABLE_NAME, CREATION_TIME_INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${CREATION_TIME_INDEX_NAME} ON ${TABLE_NAME} (creationTime)`);
        }

        const CONTENT_DELETION_INDEX_NAME = "ind_contentDeletion";
        if (!(await indexExists(queryRunner, TABLE_NAME, CONTENT_DELETION_INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${CONTENT_DELETION_INDEX_NAME} ON ${TABLE_NAME} (contentDeletedTime, creationTime)`);
        }

        const SOFT_DELETION_INDEX_NAME = "ind_softDeletion";
        if (!(await indexExists(queryRunner, TABLE_NAME, SOFT_DELETION_INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${SOFT_DELETION_INDEX_NAME} ON ${TABLE_NAME} (softDeletedTime, softDeleted)`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { indexExists } from "./helper/helper";

export class PrebuildWorkspaceRateLimiterMigration1646739309660 implements MigrationInterface {

    public static readonly TABLE_NAME = "d_b_prebuilt_workspace";
    public static readonly INDEX_NAME = "ind_prebuiltWorkspace_cloneURL_creationTime_state";
    public static readonly FIELDS = ["cloneURL", "creationTime", "state"];

    public async up(queryRunner: QueryRunner): Promise<void> {
        if(!(await indexExists(queryRunner, PrebuildWorkspaceRateLimiterMigration1646739309660.TABLE_NAME, PrebuildWorkspaceRateLimiterMigration1646739309660.INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${PrebuildWorkspaceRateLimiterMigration1646739309660.INDEX_NAME} ON ${PrebuildWorkspaceRateLimiterMigration1646739309660.TABLE_NAME} (${PrebuildWorkspaceRateLimiterMigration1646739309660.FIELDS.join(', ')})`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}

}

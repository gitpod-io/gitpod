/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists } from "./helper/helper";

const table = "d_b_org_settings";
const newColumn = "annotateGitCommits";

export class AddOrgSettingsCommitAnnotation1737714449389 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, newColumn))) {
            await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN ${newColumn} BOOLEAN DEFAULT FALSE`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, table, newColumn)) {
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN ${newColumn}`);
        }
    }
}

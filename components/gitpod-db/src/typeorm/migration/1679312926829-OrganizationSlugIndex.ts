/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { indexExists } from "./helper/helper";

const table = "d_b_team";
const column = "slug";
const idxSlug = "idx_slug";

export class OrganizationSlugIndex1679312926829 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await indexExists(queryRunner, table, idxSlug))) {
            await queryRunner.query(`CREATE INDEX \`${idxSlug}\` ON \`${table}\` (${column})`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX ${idxSlug} ON ${table};`);
    }
}

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";
import { columnExists, indexExists } from "./helper/helper";

const table = "d_b_oidc_client_config";
const column = "organizationId";
const orgIndex = "idx_organizationId";
const idOrgCompositeIndex = "idx_id_organizationId";

export class AddOrganisationIDToOIDCClientConfig1673944879912 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, table, column))) {
            await queryRunner.query(
                `ALTER TABLE ${table} ADD COLUMN ${column} varchar(255), ALGORITHM=INPLACE, LOCK=NONE`,
            );
        }

        if (!(await indexExists(queryRunner, table, orgIndex))) {
            await queryRunner.query(`CREATE INDEX \`${orgIndex}\` ON \`${table}\` (${column})`);
        }

        if (!(await indexExists(queryRunner, table, idOrgCompositeIndex))) {
            await queryRunner.query(`CREATE INDEX \`${idOrgCompositeIndex}\` ON \`${table}\` (id, ${column})`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

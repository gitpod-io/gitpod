/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class ResetAuthCodePrimaryKeys1665062302891 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE d_b_oauth_auth_code_entry SET id=(SELECT uuid());`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}

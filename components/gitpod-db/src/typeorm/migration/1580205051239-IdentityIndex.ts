/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class IdentityIndex1580205051239 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        try {
            await queryRunner.query("CREATE INDEX ind_identity_userId ON d_b_identity (userId)");
        } catch (err) {
            console.log("index may have already existed", err)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP INDEX ind_identity_userId ON d_b_identity");
    }

}

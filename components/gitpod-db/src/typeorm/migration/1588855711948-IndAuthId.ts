/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { createIndexIfNotExist } from "./helper/helper";

export class IndAuthId1588855711948 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await createIndexIfNotExist(queryRunner, 'd_b_token_entry', 'ind_authid', ['authProviderId', 'authId']);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_token_entry` DROP INDEX `ind_authid`");
    }

}

/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";
import { createIndexIfNotExist } from "./helper/helper";

export class UserCreationDateIndex1584545544610 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await createIndexIfNotExist(queryRunner, "d_b_user", "ind_creationDate", ["creationDate"]);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `d_b_user` DROP INDEX `ind_creationDate`");
    }

}

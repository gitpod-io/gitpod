/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class DropWorkspaceInstanceEvent1567086067416 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_workspace_instance_event`");
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
    }

}

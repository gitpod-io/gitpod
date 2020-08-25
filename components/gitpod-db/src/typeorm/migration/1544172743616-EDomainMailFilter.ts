/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {MigrationInterface, QueryRunner} from "typeorm";

export class EMailFilter1544172743616 implements MigrationInterface {

    protected readonly entries = [
        { domain: 'tempail.com', negative: true },
        { domain: 'ezehe.com', negative: true },
        { domain: 'radiodale.com', negative: true }
    ];

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `d_b_email_domain_filter` (`domain` varchar(255) NOT NULL, `negative` tinyint(4) NOT NULL, `_lastModified` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(`domain`)) ENGINE=InnoDB");

        const values = this.entries.map(e => `('${e.domain}', '${e.negative ? 1 : 0}')`).join(",");
        await queryRunner.query(`INSERT IGNORE INTO d_b_email_domain_filter (domain, negative) VALUES ${values}`)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE `d_b_email_domain_filter`");
    }

}

/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import {MigrationInterface, QueryRunner} from "typeorm";
import { hashOAuth } from "../../auth-provider-entry-db";
import { columnExists, indexExists } from "./helper/helper";

const TABLE_NAME = "d_b_auth_provider_entry";
const COLUMN_NAME: keyof AuthProviderEntry = "oauthRevision";
const INDEX_NAME = "ind_oauthRevision";

export class OAuthRevision1639584886082 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN ${COLUMN_NAME} varchar(128) NOT NULL DEFAULT ''`);
        }
        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (${COLUMN_NAME})`);
        }

        const entries = await queryRunner.query(`SELECT id, oauth FROM ${TABLE_NAME}`) as Pick<AuthProviderEntry, "id" | "oauth">[];
        console.log(JSON.stringify(entries));
        console.log(`oauthRevision: calculating ${entries.length} hashes...`);
        for (const entry of entries) {
            const hash = hashOAuth(entry.oauth);
            await queryRunner.query(`UPDATE ${TABLE_NAME} SET ${COLUMN_NAME} = ${hash} WHERE id = ${entry.id}`);
        }
        console.log(`oauthRevision: ${entries.length} hashes calculated.`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP INDEX ${INDEX_NAME}`);
        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN ${COLUMN_NAME}`);
    }

}

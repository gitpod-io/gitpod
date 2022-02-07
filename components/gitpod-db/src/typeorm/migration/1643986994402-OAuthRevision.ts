/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { MigrationInterface, QueryRunner } from "typeorm";
import { dbContainerModule } from "../../container-module";
import { columnExists, indexExists } from "./helper/helper";
import { Container } from 'inversify';
import { AuthProviderEntryDB } from "../../auth-provider-entry-db";
import { UserDB } from "../../user-db";

const TABLE_NAME = "d_b_auth_provider_entry";
const COLUMN_NAME: keyof AuthProviderEntry = "oauthRevision";
const INDEX_NAME = "ind_oauthRevision";

export class OAuthRevision1643986994402 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // create new column
        if (!(await columnExists(queryRunner, TABLE_NAME, COLUMN_NAME))) {
            await queryRunner.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN ${COLUMN_NAME} varchar(128) NOT NULL DEFAULT ''`);
        }

        // create index on said column
        if (!(await indexExists(queryRunner, TABLE_NAME, INDEX_NAME))) {
            await queryRunner.query(`CREATE INDEX ${INDEX_NAME} ON ${TABLE_NAME} (${COLUMN_NAME})`);
        }

        // to update all oauthRevisions we need to load all providers (to decrypt them) and
        // write them back using the DB implementation (which does the calculation for us)
        const container = new Container();
        container.load(dbContainerModule);

        container.get<UserDB>(UserDB);  // initializes encryptionProvider as side effect
        const db = container.get<AuthProviderEntryDB>(AuthProviderEntryDB);
        const allProviders = await db.findAll([]);
        const writes: Promise<AuthProviderEntry>[] = [];
        for (const provider of allProviders) {
            writes.push(db.storeAuthProvider(provider, true));
        }
        await Promise.all(writes);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP INDEX ${INDEX_NAME}`);
        await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN ${COLUMN_NAME}`);
    }

}

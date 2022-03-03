/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { QueryRunner } from 'typeorm';

export async function createIndexIfNotExist(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columns: string[],
): Promise<void> {
    if (columns.length === 0) {
        throw new Error('createIndexIfNotExist: Columns must not be empty!');
    }

    if (!indexExists(queryRunner, tableName, indexName)) {
        const columnsStr = columns.map((cn) => `\`${cn}\``).join(', ');
        await queryRunner.query(`CREATE INDEX ${indexName} ON ${tableName} (${columnsStr})`);
    }
}

export async function indexExists(queryRunner: QueryRunner, tableName: string, indexName: string): Promise<boolean> {
    const database = queryRunner.connection.options.database;
    const countResult = await queryRunner.query(
        `SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
            WHERE   table_schema = '${database}'
                AND table_name = '${tableName}'
                AND index_name = '${indexName}'`,
    );
    return Number.parseInt(countResult[0].cnt) > 0; // for composite indexes this seems to return the number of columns involved
}

export async function columnExists(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<boolean> {
    const database = queryRunner.connection.options.database;
    const countResult = await queryRunner.query(
        `SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
            WHERE   table_schema = '${database}'
                AND table_name = '${tableName}'
                AND column_name = '${columnName}'`,
    );
    return Number.parseInt(countResult[0].cnt) === 1;
}

export async function tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
    const database = queryRunner.connection.options.database;
    const countResult = await queryRunner.query(
        `SELECT COUNT(1) AS cnt FROM INFORMATION_SCHEMA.TABLES
            WHERE table_schema = '${database}'
                AND table_name = '${tableName}'`,
    );
    return Number.parseInt(countResult[0].cnt) === 1;
}

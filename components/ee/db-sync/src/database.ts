/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { createConnection, Connection, QueryOptions } from "mysql";
import { NamedConnectionConfig } from "./config";

export type NamedConnection = Connection & { name: string };

export async function connect(db: NamedConnectionConfig): Promise<NamedConnection> {
    const conn = createConnection({
        ...(db as Omit<NamedConnectionConfig, "name">),
        multipleStatements: true,
        charset: "utf8mb4",

        // This is VERY IMPORTANT: all our dealings with timestamps have to be in UTC as we're working
        // across different timezones and MySQL converts timestamp values to the connection-local timezone.
        timezone: "UTC",

        // do NOT convert timestamps to Date objects
        dateStrings: true,
    }) as NamedConnection;
    return new Promise<NamedConnection>((resolve, reject) => {
        conn.name = db.name || `${db.host}:${db.port}/${db.database}`;
        conn.connect((err) => {
            if (err) {
                reject(err);
            } else {
                resolve(conn);
            }
        });
    });
}

export async function query(conn: Connection, sql: string, args?: Omit<QueryOptions, "sql">) {
    return new Promise((resolve, reject) => {
        conn.query({ sql, ...args }, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

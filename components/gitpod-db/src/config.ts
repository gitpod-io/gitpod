/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { getEnvVarParsed, getEnvVar } from "@gitpod/gitpod-protocol/lib/env";
import { ConnectionConfig } from "mysql";

@injectable()
export class Config {
    get dbConfig(): DatabaseConfig {
        // defaults to be used only in tests
        const dbSetup: DatabaseConfig = {
            host: process.env.DB_HOST || "localhost",
            port: getEnvVarParsed("DB_PORT", Number.parseInt, "23306"),
            username: process.env.DB_USERNAME || "gitpod",
            password: process.env.DB_PASSWORD || "test",
            database: process.env.DB_NAME || "gitpod",
        };

        if (process.env.DB_CA_CERT) {
            dbSetup.ssl = {
                ca: process.env.DB_CA_CERT,
            };
        }

        log.info(`Using DB: ${dbSetup.host}:${dbSetup.port}/${dbSetup.database}`);

        return dbSetup;
    }

    get mysqlConfig(): ConnectionConfig {
        const dbConfig = this.dbConfig;
        const mysqlConfig: ConnectionConfig = {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
        };
        if (dbConfig.ssl?.ca) {
            mysqlConfig.ssl = {
                ca: dbConfig.ssl.ca,
            };
        }
        return mysqlConfig;
    }

    get dbEncryptionKeys(): string {
        return getEnvVar(
            "DB_ENCRYPTION_KEYS",
            `[{"name":"general","version":1,"primary":true,"material":"5vRrp0H4oRgdkPnX1qQcS54Q0xggr6iyho42IQ1rO+c="}]`,
        );
    }
}

export interface DatabaseConfig {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: {
        ca?: string;
    };
}

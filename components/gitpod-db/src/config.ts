/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { getEnvVarParsed, getEnvVar } from '@gitpod/gitpod-protocol/lib/env';
import { ConnectionConfig } from 'mysql';

@injectable()
export class Config {
    get dbConfig(): DatabaseConfig {
        // defaults to be used only in tests
        const dbSetup = {
            host: process.env.DB_HOST || 'localhost',
            port: getEnvVarParsed('DB_PORT', Number.parseInt, '3306'),
            username: process.env.DB_USERNAME || 'gitpod',
            password: process.env.DB_PASSWORD || 'test',
            database: process.env.DB_NAME || 'gitpod',
        };

        log.info(`Using DB: ${dbSetup.host}:${dbSetup.port}/${dbSetup.database}`);

        return dbSetup;
    }

    get mysqlConfig(): ConnectionConfig {
        const dbConfig = this.dbConfig;
        return {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
        };
    }

    get dbEncryptionKeys(): string {
        return getEnvVar('DB_ENCRYPTION_KEYS');
    }

    get deletedEntryGCConfig(): DeletedEntryGCConfig {
        const enabled = getEnvVar('DB_DELETED_ENTRIES_GC_ENABLED', 'true') === 'true';
        const intervalMS = parseInt(getEnvVar('DB_DELETED_ENTRIES_GC_INTERVAL', (10 * 60 * 1000).toString()));
        return { enabled, intervalMS };
    }
}

export interface DatabaseConfig {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
}

export interface DeletedEntryGCConfig {
    enabled: boolean;
    intervalMS: number;
}

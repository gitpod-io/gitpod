/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, optional } from "inversify";

import { Connection, createConnection, ConnectionOptions, getConnectionManager, ColumnOptions } from "typeorm";
import { Config } from "../config";
import { DefaultNamingStrategy } from "./naming-strategy";

export const TypeORMOptions = Symbol('TypeORMOptions');

@injectable()
export class TypeORM {
    static readonly DEFAULT_CONNECTION_NAME = 'default';
    static readonly UUID_COLUMN_TYPE: ColumnOptions = {
        type: 'char',
        length: 36
    };
    static readonly WORKSPACE_ID_COLUMN_TYPE: ColumnOptions = {
        type: 'char',
        length: 36
    };

    static defaultOptions(dir: string): ConnectionOptions {
        console.log(`Loading TypeORM entities and migrations from ${dir}`);
        return {
            type: "mysql",
            synchronize: false,
            migrationsRun: false,
            logging: false,
            connectTimeout: 20000,
            timezone: 'utc',
            charset: 'utf8mb4',
            entities: [
                dir + "/entity/**/*.js",
                dir + "/entity/**/*.ts"
            ],
            migrations: [
                dir + "/migration/*.js",
                dir + "/migration/*.ts"
            ],
            subscribers: [
                dir + "/subscriber/**/*.js"
            ],
            cli: {
                entitiesDir: "src/typeorm/entity",
                migrationsDir:  "src/typeorm/migration",
                subscribersDir:  "src/typeorm/subscriber"
            },
            namingStrategy: new DefaultNamingStrategy(),
        };
    }

    protected _connection?: Connection = undefined;
    protected readonly _options: ConnectionOptions;

    constructor(@inject(Config) protected readonly config: Config,
        @inject(TypeORMOptions) @optional() protected readonly options: Partial<ConnectionOptions>) {
        options = options || {};
        this._options = {
            ...TypeORM.defaultOptions(__dirname),
            ...this.config.dbConfig,
            ...options
        } as ConnectionOptions;
    }

    public async getConnection() {
        if (this._connection === undefined) {
            const connectionMgr = getConnectionManager();
            if (connectionMgr.has(TypeORM.DEFAULT_CONNECTION_NAME)) {
                this._connection = connectionMgr.get(TypeORM.DEFAULT_CONNECTION_NAME);
            } else {
                this._connection = await createConnection({
                    ...this._options,
                    name: TypeORM.DEFAULT_CONNECTION_NAME
                });
            }
        }
        return this._connection;
    }

    public async connect() {
        await this.getConnection();
    }
}
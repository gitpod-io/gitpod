/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { injectable, inject, optional } from "inversify";

import { Connection, ConnectionOptions, PrimaryColumnOptions, getConnectionManager, createConnection } from "typeorm";
import { Config } from "../config";
import { DefaultNamingStrategy } from "./naming-strategy";

export const TypeORMOptions = Symbol("TypeORMOptions");

@injectable()
export class TypeORM {
    static readonly DEFAULT_CONNECTION_NAME = "default";
    static readonly UUID_COLUMN_TYPE: PrimaryColumnOptions = {
        type: "char",
        length: 36,
    };
    static readonly WORKSPACE_ID_COLUMN_TYPE: PrimaryColumnOptions = {
        type: "char",
        length: 36,
    };

    static defaultOptions(dir: string): ConnectionOptions {
        console.log(`Loading TypeORM entities and migrations from ${dir}`);
        return {
            type: "mysql",
            synchronize: false,
            migrationsRun: false,
            logging: false,
            connectTimeout: 20000,
            timezone: "utc",
            charset: "utf8mb4",
            entities: [dir + "/entity/**/*.js", dir + "/entity/**/*.ts"],
            migrations: [dir + "/migration/*.js", dir + "/migration/*.ts"],
            subscribers: [dir + "/subscriber/**/*.js"],
            cli: {
                entitiesDir: "src/typeorm/entity",
                migrationsDir: "src/typeorm/migration",
                subscribersDir: "src/typeorm/subscriber",
            },
            namingStrategy: new DefaultNamingStrategy(),
            extra: {
                // default is 10 (see https://github.com/mysqljs/mysql#pool-options), which is too low for our use case
                connectionLimit: 40,
            },
        };
    }

    protected _connection: undefined | Deferred<Connection> = undefined;
    protected readonly _options: ConnectionOptions;

    constructor(
        @inject(Config) protected readonly config: Config,
        @inject(TypeORMOptions) @optional() protected readonly options?: Partial<ConnectionOptions>,
    ) {
        options = options || {};
        this._options = {
            ...TypeORM.defaultOptions(__dirname),
            ...this.config.dbConfig,
            ...options,
        } as ConnectionOptions;
    }

    public async getConnection(): Promise<Connection> {
        const connectionManager = getConnectionManager();
        if (this._connection === undefined) {
            this._connection = new Deferred();

            let connection: Connection;
            if (connectionManager.has(TypeORM.DEFAULT_CONNECTION_NAME)) {
                // This path is important for the CLI, where the "default" connection at this point already
                // is initialized from "ormconfig.ts"
                connection = connectionManager.get(TypeORM.DEFAULT_CONNECTION_NAME);
            } else {
                // Default path for all apps (server, etc.)
                connection = await createConnection({
                    // cannot be connectionMgr.create() as suggested by docs
                    ...this._options,
                    name: TypeORM.DEFAULT_CONNECTION_NAME,
                });
            }
            this._connection.resolve(connection);
        }

        return await this._connection!.promise;
    }

    public async connect() {
        await this.getConnection();
    }
}

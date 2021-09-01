/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import 'mocha'
import { Connection } from 'mysql';
import * as chai from 'chai';
const expect = chai.expect;
import { connect, query, NamedConnection } from '../database';
import { Config } from '@gitpod/gitpod-db/lib/config';
import { ConnectionConfig } from 'mysql';
import { Container, injectable } from 'inversify';
import { productionContainerModule } from '../container-module';
import { TableDescriptionProvider, TableDescription } from '@gitpod/gitpod-db/lib/tables';
import { PeriodicReplicator } from '../replication';

const dbConfig = new Config().mysqlConfig;

describe('Basic unidirectional replication', () => {
    let container: Container;
    let source: NamedConnection;
    let target: NamedConnection;

    beforeEach(async function () {
        this.timeout(10000);
        container = new Container();
        container.load(productionContainerModule);
        container.unbind(TableDescriptionProvider);
        container.bind(TableDescriptionProvider).to(TestTableDescriptionProvider).inSingletonScope();
        container.bind(TestTableDescriptionProvider).toSelf().inSingletonScope();

        source = await recreateDatabase(dbConfig, 'gitpod-test-sync-src');
        target = await recreateDatabase(dbConfig, 'gitpod-test-sync-dest');
    });

    afterEach(async () => {
        if(source) source.destroy();
        if(target) target.destroy();
    })

    it('Should replicate everything', async () => {
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", "1970-01-01 00:00:01.001", 0)`)

        const replicator = container.get(PeriodicReplicator);
        replicator.setup(source, [target], 0, undefined);
        await replicator.synchronize(true);

        expect(await query(target, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1970-01-01 00:00:01.001",
                "name": "Foo",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
            },
            {
                "_deleted": 0,
                "_lastModified": "1970-01-01 00:00:01.001",
                "name": "Bar",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035d"
            }
        ]);
    })

    it('Should replicate with a start date', async () => {
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", "1980-01-01 00:00:01.001", 0)`)

        const replicator = container.get(PeriodicReplicator);
        replicator.setup(source, [target], 0, undefined);

        // explicitly mark the last replication time
        await replicator.markLastExportDate(new Date("1975-01-01T00:00:01.000Z"));
        await replicator.synchronize(false);


        expect(await query(target, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1980-01-01 00:00:01.001",
                "name": "Bar",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035d"
            }
        ]);
    })

    it('Should replicate with an end date');

    it('Should overwrite outdated values and keep newer ones intact', async () => {
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo Old", "1970-01-01 00:00:01.001", 0)`)
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar Expected", "1980-01-01 00:00:01.001", 0)`)

        await query(target, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo Expected", "1980-01-01 00:00:01.001", 0)`)
        await query(target, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar Old", "1970-01-01 00:00:01.001", 0)`)

        const replicator = container.get(PeriodicReplicator);
        replicator.setup(source, [target], 0, undefined);

        // explicitly mark the last replication time
        await replicator.synchronize(false);

        expect(await query(target, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1980-01-01 00:00:01.001",
                "name": "Foo Expected",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
            },
            {
                "_deleted": 0,
                "_lastModified": "1980-01-01 00:00:01.001",
                "name": "Bar Expected",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035d"
            }
        ]);
    })

    it('Should mark the last replication time', async () => {
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", "1970-01-01 00:00:01.001", 0)`)

        const replicator = container.get(PeriodicReplicator);
        replicator.setup(source, [target], 0, undefined);
        await replicator.synchronize(true);

        const lastExport = await query(source, 'SELECT * FROM gitpod_replication WHERE item="lastExport"') as any[];
        expect(lastExport).to.be.not.empty;
        expect(lastExport[0].item).to.equal("lastExport");
        expect(Date.now() - new Date(lastExport[0].value).getTime()).to.be.greaterThan(0);
    })

    it('Should pick up from the last replication time', async () => {
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)

        const replicator = container.get(PeriodicReplicator);
        replicator.setup(source, [target], 0, undefined);
        await replicator.synchronize(true);

        const lastExport = await query(source, 'SELECT * FROM gitpod_replication WHERE item="lastExport"') as any[];
        expect(lastExport).to.be.not.empty;
        expect(lastExport[0].item).to.equal("lastExport");

        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", ?, 0)`, { values: [ new Date(lastExport[0].value) ] })
        await replicator.synchronize(false);

        expect(await query(target, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1970-01-01 00:00:01.001",
                "name": "Foo",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
            },
            {
                "_deleted": 0,
                "_lastModified": lastExport[0].value.toString().replace('T', ' ').replace('Z', ''),
                "name": "Bar",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035d"
            }
        ]);
    })

    it('Should delete entries', async () => {
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", "1970-01-02 00:00:01.001", 1)`)
        await query(target, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(target, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", "1970-01-01 00:00:01.001", 0)`)


        const replicator = container.get(PeriodicReplicator);
        replicator.setup(source, [target], 0, undefined);
        await replicator.synchronize(true);

        expect(await query(source, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1970-01-01 00:00:01.001",
                "name": "Foo",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
            },
        ], 'did not delete in source');
        expect(await query(target, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1970-01-01 00:00:01.001",
                "name": "Foo",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
            },
        ], 'did not delete in target');
    });

    it('Should delete only if entry is older', async () => {
        const middle = await recreateDatabase(dbConfig, 'gitpod-test-sync-mid');

        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(source, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", "1970-01-02 00:00:01.001", 1)`)
        await query(middle, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(middle, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Changed", "1970-01-03 00:00:01.001", 0)`)
        await query(target, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035c", "Foo", "1970-01-01 00:00:01.001", 0)`)
        await query(target, `INSERT INTO names VALUES ("9fa18735-c43b-4651-81c5-ddfbdee1035d", "Bar", "1970-01-01 00:00:01.001", 0)`)

        const sourceMidTargetRepl = container.get(PeriodicReplicator);
        sourceMidTargetRepl.setup(source, [target, middle], 0, undefined);
        // debugger
        await sourceMidTargetRepl.synchronize(true);

        expect(await query(source, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1970-01-01 00:00:01.001",
                "name": "Foo",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
            },
        ], 'did not delete in source');
        expect(await query(middle, 'SELECT * FROM names')).to.deep.equal([
            {
                "_deleted": 0,
                "_lastModified": "1970-01-01 00:00:01.001",
                "name": "Foo",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
            },
            {
                "_deleted": 0,
                "_lastModified": "1970-01-03 00:00:01.001",
                "name": "Changed",
                "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035d"
            },
        ], 'did delete in middle');

        const midTaretSourceRepl = container.get(PeriodicReplicator);
        midTaretSourceRepl.setup(middle, [source, target], 0, undefined);
        await midTaretSourceRepl.synchronize(true);
        const targetSourceMidRepl = container.get(PeriodicReplicator);
        targetSourceMidRepl.setup(target, [source, middle], 0, undefined);
        await targetSourceMidRepl.synchronize(true);

        const dbs: { [idx: string]: NamedConnection } = { source, middle, target };
        for (const k in dbs) {
            expect(await query(dbs[k], 'SELECT * FROM names')).to.deep.equal([
                {
                    "_deleted": 0,
                    "_lastModified": "1970-01-01 00:00:01.001",
                    "name": "Foo",
                    "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035c"
                },
                {
                    "_deleted": 0,
                    "_lastModified": "1970-01-03 00:00:01.001",
                    "name": "Changed",
                    "uid": "9fa18735-c43b-4651-81c5-ddfbdee1035d"
                },
            ], `did delete in ${k} after full sync round`);
        }
    })

})

async function recreateDatabase(cfg: ConnectionConfig, dbName: string): Promise<NamedConnection> {
    const conn = await connect({ ...cfg, database: undefined, name: dbName });

    await query(conn, `DROP DATABASE IF EXISTS \`${dbName}\``);
    await query(conn, `CREATE DATABASE \`${dbName}\` CHARSET utf8mb4`);
    await query(conn, `USE \`${dbName}\``);
    await query(conn, `set time_zone='+00:00'`);
    await TestTableDescriptionProvider.createTables(conn);

    return conn;
}

@injectable()
class TestTableDescriptionProvider {
    readonly name = "test";
    public getSortedTables(): TableDescription[] {
        return [
            {
                name: "names",
                primaryKeys: [ "uid" ],
                timeColumn: "_lastModified",
                deletionColumn: "_deleted",
            }
        ]
    }
}

namespace TestTableDescriptionProvider {
    export async function createTables(conn: Connection) {
        await query(conn, "CREATE TABLE IF NOT EXISTS names (uid CHAR(36) NOT NULL PRIMARY KEY, name char(36) NOT NULL, _lastModified timestamp(3) NOT NULL, _deleted tinyint(4) NOT NULL DEFAULT 0) ENGINE=InnoDB;");
    }
}
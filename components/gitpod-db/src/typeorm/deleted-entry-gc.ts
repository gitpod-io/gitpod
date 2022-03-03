/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { TypeORM } from './typeorm';
import { Config } from '../config';
import { repeat } from '@gitpod/gitpod-protocol/lib/util/repeat';
import { Disposable, DisposableCollection } from '@gitpod/gitpod-protocol';

@injectable()
export class DeletedEntryGC implements Disposable {
    @inject(TypeORM) protected readonly typeORM: TypeORM;
    @inject(Config) protected readonly config: Config;

    protected readonly disposables = new DisposableCollection();

    public start() {
        const cfg = this.config.deletedEntryGCConfig;
        if (!cfg.enabled) {
            console.info('Deleted Entries GC disabled');
            return;
        }

        console.info(`Deleted Entries GC enabled (running every ${cfg.intervalMS / (60 * 1000)} minutes)`);
        this.disposables.push(
            repeat(
                () => this.gc().catch((e) => console.error('error while removing deleted entries', e)),
                cfg.intervalMS,
            ),
        );
    }

    public dispose() {
        this.disposables.dispose();
    }

    protected async gc() {
        const conn = await this.typeORM.getConnection();
        await Promise.all(tables.map((t) => conn.query(`DELETE FROM ${t.name} WHERE ${t.deletionColumn} = 1`)));
    }
}

const tables: TableWithDeletion[] = [
    { deletionColumn: 'deleted', name: 'd_b_identity' },
    { deletionColumn: 'deleted', name: 'd_b_user_storage_resource' },
    { deletionColumn: 'deleted', name: 'd_b_workspace' },
    { deletionColumn: 'deleted', name: 'd_b_workspace_instance' },
    { deletionColumn: 'deleted', name: 'd_b_token_entry' },
    { deletionColumn: 'deleted', name: 'd_b_gitpod_token' },
    { deletionColumn: 'deleted', name: 'd_b_one_time_secret' },
    { deletionColumn: 'deleted', name: 'd_b_auth_provider_entry' },
    { deletionColumn: 'deleted', name: 'd_b_code_sync_resource' },
    { deletionColumn: 'deleted', name: 'd_b_team' },
    { deletionColumn: 'deleted', name: 'd_b_team_membership' },
    { deletionColumn: 'deleted', name: 'd_b_team_membership_invite' },
    { deletionColumn: 'deleted', name: 'd_b_project' },
    { deletionColumn: 'deleted', name: 'd_b_prebuild_info' },
    { deletionColumn: 'deleted', name: 'd_b_oss_allow_list' },
    { deletionColumn: 'deleted', name: 'd_b_project_env_var' },
    { deletionColumn: 'deleted', name: 'd_b_project_info' },
];

interface TableWithDeletion {
    name: string;
    deletionColumn: string;
}

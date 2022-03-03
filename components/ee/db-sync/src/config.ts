/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ConnectionConfig } from 'mysql';

export type NamedConnectionConfig = ConnectionConfig & { name?: string };

export interface ReplicationConfig {
    syncPeriod: number;
    roundRobin: boolean;
    source: NamedConnectionConfig;
    targets: NamedConnectionConfig[];
    tableSet: 'gitpod' | 'gitpod-sessions';
    disableTransactions: boolean;
    replicationLogDir: string | undefined;
}

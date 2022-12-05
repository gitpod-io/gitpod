/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ConnectionConfig } from "mysql";

export type NamedConnectionConfig = ConnectionConfig & { name?: string };

export interface ReplicationConfig {
    syncPeriod: number;
    roundRobin: boolean;
    source?: NamedConnectionConfig;
    targets: NamedConnectionConfig[];
    tableSet: "gitpod" | "gitpod-sessions";
    disableTransactions: boolean;
    replicationLogDir: string | undefined;
}

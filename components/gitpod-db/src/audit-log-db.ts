/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuditLog } from "@gitpod/gitpod-protocol/lib/audit-log";

export const AuditLogDB = Symbol("AuditLogDB");

export interface AuditLogDB {
    /**
     *  Records an audit log entry.
     *
     * @param logEntry
     */
    recordAuditLog(logEntry: AuditLog): Promise<void>;

    /**
     * Lists audit logs.
     *
     * @param organizationId
     * @param params
     */
    listAuditLogs(
        organizationId: string,
        params?: {
            from?: string;
            to?: string;
            actorId?: string;
            action?: string;
            pagination?: {
                offset?: number;
                // must not be larger than 250, default is 100
                limit?: number;
            };
        },
    ): Promise<AuditLog[]>;

    /**
     * Purges audit logs older than the given date.
     *
     * @param before ISO 8601 date string
     */
    purgeAuditLogs(before: string, organizationId?: string): Promise<number>;
}

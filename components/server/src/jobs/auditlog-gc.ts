/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { AuditLogService } from "../audit/AuditLogService";
import { Job } from "./runner";

@injectable()
export class AuditLogGarbageCollectorJob implements Job {
    @inject(AuditLogService) private readonly db: AuditLogService;

    public name = "auditlog-gc";
    // once a day
    public frequencyMs = 24 * 60 * 60 * 1000;
    private readonly retentionDays = 90;

    public async run(): Promise<number | undefined> {
        const before = new Date();
        before.setDate(before.getDate() - this.retentionDays);
        return await this.db.purgeAuditLogs(before.toISOString());
    }
}

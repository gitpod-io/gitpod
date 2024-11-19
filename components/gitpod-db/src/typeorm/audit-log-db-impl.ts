/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { TypeORM } from "./typeorm";

import { AuditLog } from "@gitpod/gitpod-protocol/lib/audit-log";
import { Between, FindConditions, LessThan, Repository } from "typeorm";
import { AuditLogDB } from "../audit-log-db";
import { DBAuditLog } from "./entity/db-audit-log";

@injectable()
export class AuditLogDBImpl implements AuditLogDB {
    @inject(TypeORM) typeORM: TypeORM;

    private async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    private async getRepo(): Promise<Repository<DBAuditLog>> {
        return (await this.getEntityManager()).getRepository(DBAuditLog);
    }

    async recordAuditLog(logEntry: AuditLog): Promise<void> {
        const repo = await this.getRepo();
        await repo.insert(logEntry);
    }

    async listAuditLogs(
        organizationId: string,
        params?:
            | {
                  from?: string;
                  to?: string;
                  actorId?: string;
                  action?: string;
                  pagination?: { offset?: number; limit?: number };
              }
            | undefined,
    ): Promise<AuditLog[]> {
        const repo = await this.getRepo();
        const where: FindConditions<DBAuditLog> = {
            organizationId,
        };
        if (params?.from && params?.to) {
            where.timestamp = Between(params.from, params.to);
        }
        if (params?.actorId) {
            where.actorId = params.actorId;
        }
        if (params?.action) {
            where.action = params.action;
        }
        return repo.find({
            where,
            order: {
                timestamp: "DESC",
            },
            skip: params?.pagination?.offset,
            take: params?.pagination?.limit,
        });
    }

    async purgeAuditLogs(before: string, organizationId?: string): Promise<number> {
        const repo = await this.getRepo();
        const findConditions: FindConditions<DBAuditLog> = {
            timestamp: LessThan(before),
        };
        if (organizationId) {
            findConditions.organizationId = organizationId;
        }
        const result = await repo.delete(findConditions);
        return result.affected ?? 0;
    }
}

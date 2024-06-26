/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { AuditLogService as AuditLogServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/auditlogs_connect";
import { ListAuditLogsRequest, ListAuditLogsResponse } from "@gitpod/public-api/lib/gitpod/v1/auditlogs_pb";
import { inject, injectable } from "inversify";
import { AuditLogService } from "../audit/AuditLogService";
import { ctxUserId } from "../util/request-context";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { parsePagination } from "@gitpod/public-api-common/lib/public-api-pagination";
import { validate as uuidValidate } from "uuid";

@injectable()
export class AuditLogServiceAPI implements ServiceImpl<typeof AuditLogServiceInterface> {
    @inject(AuditLogService)
    private readonly auditLogService: AuditLogService;
    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    async listAuditLogs(req: ListAuditLogsRequest, _: HandlerContext): Promise<ListAuditLogsResponse> {
        if (req.pagination?.pageSize && req.pagination?.pageSize > 400) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Pagesize must not exceed 400");
        }
        const page = parsePagination(req.pagination, 100, 400);
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        const toDate = req.to?.toDate() || new Date();
        // default 7 days before toDate
        const fromDate = req.from?.toDate() || new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const result = await this.auditLogService.listAuditLogs(ctxUserId(), req.organizationId, {
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            actorId: req.actorId,
            action: req.action,
            pagination: page,
        });
        return new ListAuditLogsResponse({
            auditLogs: result.map((l) => this.apiConverter.toAuditLog(l)),
            pagination: {
                total: result.length,
            },
        });
    }
}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, WorkspaceType } from "./protocol";

export interface BillableSession {
    // The id of the one paying the bill
    attributionId: string;

    // Relevant for workspace type. When prebuild, shows "prebuild"
    userId?: string;
    teamId?: string;

    instanceId: string;

    workspaceId: string;

    workspaceType: BillableWorkspaceType;

    workspaceClass: string;

    // When the workspace started
    startTime: string;

    // When the workspace ended. Not set when the workspace is still running.
    endTime?: string;

    // The credits used for this session
    credits: number;

    // TODO - maybe
    projectId?: string;
}

export interface ExtendedBillableSession extends BillableSession {
    contextURL?: string;
    user?: Pick<User.Profile, "name" | "avatarURL">;
}

/**
 * This is a paginated request
 */
export interface ListBilledUsageRequest {
    attributionId: string;
    fromDate?: number;
    toDate?: number;
    perPage: number;
    page: number;
}

export interface ListBilledUsageResponse {
    sessions: ExtendedBillableSession[];
    totalCreditsUsed: number;
    totalPages: number;
    totalSessions: number;
    perPage: number;
    page: number;
}

export type BillableWorkspaceType = WorkspaceType;

// types below are copied over from components/usage-api/typescript/src/usage/v1/usage_pb.d.ts

export interface ListUsageRequest {
    attributionId: string;
    from?: number;
    to?: number;
    order: Ordering;
    pagination?: PaginationRequest;
}

export enum Ordering {
    ORDERING_DESCENDING = 0,
    ORDERING_ASCENDING = 1,
}

export interface PaginationRequest {
    perPage: number;
    page: number;
}

export interface ListUsageResponse {
    usageEntriesList: Usage[];
    pagination?: PaginationResponse;
    creditBalanceAtStart: number;
    creditBalanceAtEnd: number;
}

export interface PaginationResponse {
    perPage: number;
    totalPages: number;
    total: number;
    page: number;
}

export type UsageKind = "workspaceinstance" | "invoice";
export interface Usage {
    id: string;
    attributionId: string;
    description: string;
    credits: number;
    effectiveTime?: number;
    kind: UsageKind;
    workspaceInstanceId: string;
    draft: boolean;
    metadata: WorkspaceInstanceUsageData | InvoiceUsageData;
}

// the equivalent golang shape is maintained in `/workspace/gitpod/`components/usage/pkg/db/usage.go`
export interface WorkspaceInstanceUsageData {
    workspaceId: string;
    workspaceType: WorkspaceType;
    workspaceClass: string;
    contextURL: string;
    startTime: string;
    endTime?: string;
    userName: string;
    userAvatarURL: string;
}

export interface InvoiceUsageData {
    invoiceId: string;
    startDate: string;
    endDate: string;
}

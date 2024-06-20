/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceType } from "./protocol";

// types below are manually kept in sycn with components/usage-api/typescript/src/usage/v1/usage_pb.d.ts
export interface ListUsageRequest {
    attributionId: string;
    userId?: string;
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
    creditsUsed: number;
    ledgerIntervalMinutes?: number;
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
    creationTime?: string;
    startTime: string;
    endTime?: string;
    stoppedTime?: string;
    userId: string;
    userName: string;
    userAvatarURL: string;
}

export interface InvoiceUsageData {
    invoiceId: string;
    startDate: string;
    endDate: string;
}

export interface CostCenterJSON {
    attributionId: string;
    spendingLimit: number;
    billingStrategy: CostCenter_BillingStrategy;
    nextBillingTime?: string;
    billingCycleStart?: string;
}

export enum CostCenter_BillingStrategy {
    BILLING_STRATEGY_STRIPE = "BILLING_STRATEGY_STRIPE",
    BILLING_STRATEGY_OTHER = "BILLING_STRATEGY_OTHER",
    UNRECOGNIZED = "UNRECOGNIZED",
}

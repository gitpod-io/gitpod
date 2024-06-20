/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    CostCenter_BillingStrategy,
    ListUsageRequest_Ordering,
    UsageServiceClient,
    UsageServiceDefinition,
    Usage_Kind,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { inject, injectable } from "inversify";
import { Authorizer } from "../authorization/authorizer";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { CostCenterJSON, ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

@injectable()
export class UsageService {
    constructor(
        @inject(UsageServiceDefinition.name) private readonly usageService: UsageServiceClient,
        @inject(Authorizer) private readonly authorizer: Authorizer,
    ) {}

    async getCostCenter(userId: string, organizationId: string): Promise<CostCenterJSON> {
        await this.authorizer.checkPermissionOnOrganization(userId, "read_info", organizationId);

        const { costCenter } = await this.usageService.getCostCenter({
            attributionId: AttributionId.render(AttributionId.createFromOrganizationId(organizationId)),
        });
        if (!costCenter) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Not found");
        }
        return {
            ...costCenter,
            billingCycleStart: costCenter.billingCycleStart ? costCenter.billingCycleStart.toISOString() : undefined,
            nextBillingTime: costCenter.nextBillingTime ? costCenter.nextBillingTime.toISOString() : undefined,
        };
    }

    async setUsageLimit(userId: string, organizationId: string, usageLimit: number): Promise<void> {
        if (typeof usageLimit !== "number" || usageLimit < 0) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Unexpected usageLimit value: ${usageLimit}`);
        }

        await this.authorizer.checkPermissionOnOrganization(userId, "write_billing", organizationId);

        const costCenter = await this.getCostCenter(userId, organizationId);
        if (costCenter?.billingStrategy !== CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE) {
            await this.authorizer.checkPermissionOnOrganization(userId, "write_billing_admin", organizationId);
        }
        await this.usageService.setCostCenter({
            costCenter: {
                attributionId: AttributionId.render(AttributionId.createFromOrganizationId(organizationId)),
                spendingLimit: usageLimit,
                billingStrategy: costCenter.billingStrategy,
            },
        });
    }

    async listUsage(userId: string, req: ListUsageRequest): Promise<ListUsageResponse> {
        const { from, to } = req;
        const attributionId = AttributionId.parse(req.attributionId);
        if (!attributionId) {
            throw new ApplicationError(ErrorCodes.INVALID_COST_CENTER, "Bad attribution ID", {
                attributionId: req.attributionId,
            });
        }
        const orgId = attributionId.teamId;
        // check if the user has access to why they requested
        let requestedUserId = req.userId;
        if (requestedUserId !== userId) {
            try {
                // asking for everybody's usage
                await this.authorizer.checkPermissionOnOrganization(userId, "read_billing", orgId);
            } catch (err) {
                if (ApplicationError.hasErrorCode(err) && err.code === ErrorCodes.PERMISSION_DENIED) {
                    // downgrade to user's usage only
                    requestedUserId = userId;
                } else {
                    throw err;
                }
            }
        }
        await this.authorizer.checkPermissionOnOrganization(userId, "read_info", orgId);

        const response = await this.usageService.listUsage({
            attributionId: AttributionId.render(attributionId),
            userId: requestedUserId,
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
            order: ListUsageRequest_Ordering.ORDERING_DESCENDING,
            pagination: {
                page: req.pagination?.page,
                perPage: req.pagination?.perPage,
            },
        });
        return {
            usageEntriesList: response.usageEntries.map((u) => {
                return {
                    id: u.id,
                    attributionId: u.attributionId,
                    effectiveTime: u.effectiveTime && u.effectiveTime.getTime(),
                    credits: u.credits,
                    description: u.description,
                    draft: u.draft,
                    workspaceInstanceId: u.workspaceInstanceId,
                    kind: u.kind === Usage_Kind.KIND_WORKSPACE_INSTANCE ? "workspaceinstance" : "invoice",
                    metadata: !!u.metadata ? JSON.parse(u.metadata) : undefined,
                };
            }),
            pagination: response.pagination
                ? {
                      page: response.pagination.page,
                      perPage: response.pagination.perPage,
                      total: response.pagination.total,
                      totalPages: response.pagination.totalPages,
                  }
                : undefined,
            creditsUsed: response.creditsUsed,
            ledgerIntervalMinutes: (response.ledgerInterval?.seconds || 0) / 60,
        };
    }

    async getCurrentBalance(
        userId: string,
        organizationId: string,
    ): Promise<{ usedCredits: number; usageLimit: number }> {
        await this.authorizer.checkPermissionOnOrganization(userId, "read_billing", organizationId);

        const attributionId = AttributionId.createFromOrganizationId(organizationId);
        const costCenter = this.getCostCenter(userId, organizationId);
        const getBalanceResponse = await this.usageService.getBalance({
            attributionId: AttributionId.render(attributionId),
        });
        const currentInvoiceCredits = getBalanceResponse.credits;

        return {
            usedCredits: currentInvoiceCredits,
            usageLimit: (await costCenter)?.spendingLimit || 0,
        };
    }

    async checkUsageLimitReached(userId: string, organizationId: string): Promise<UsageLimitReachedResult> {
        const attributionId = AttributionId.createFromOrganizationId(organizationId);
        const creditBalance = await this.getCurrentBalance(userId, organizationId);
        const currentInvoiceCredits = creditBalance.usedCredits;
        const usageLimit = creditBalance.usageLimit;
        if (currentInvoiceCredits >= usageLimit) {
            log.info({ userId, organizationId }, "Usage limit reached", {
                attributionId,
                currentInvoiceCredits: new TrustedValue(currentInvoiceCredits),
                usageLimit,
            });
            return {
                reached: true,
                attributionId,
            };
        } else if (currentInvoiceCredits > usageLimit * 0.8) {
            log.info({ userId, organizationId }, "Usage limit almost reached", {
                attributionId,
                currentInvoiceCredits: new TrustedValue(currentInvoiceCredits),
                usageLimit,
            });
            return {
                reached: false,
                almostReached: true,
                attributionId,
            };
        }

        return {
            reached: false,
            attributionId,
        };
    }

    async addCreditNote(userId: string, organizationId: string, credits: number, description: string): Promise<void> {
        await this.authorizer.checkPermissionOnOrganization(userId, "write_billing_admin", organizationId);
        await this.usageService.addUsageCreditNote({
            attributionId: AttributionId.render(AttributionId.createFromOrganizationId(organizationId)),
            credits,
            description,
            userId,
        });
    }

    /**
     * @deprecated
     */
    async subscribeToStripe(userId: string, organizationId: string, usageLimit: number): Promise<void> {
        //TODO users should not be able to do this. Instead this should be done by a stripe webhook
        await this.usageService.setCostCenter({
            costCenter: {
                attributionId: AttributionId.render(AttributionId.createFromOrganizationId(organizationId)),
                spendingLimit: usageLimit,
                billingStrategy: CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE,
            },
        });
    }
}

export interface UsageLimitReachedResult {
    reached: boolean;
    almostReached?: boolean;
    attributionId: AttributionId;
}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { GitpodServerImpl, traceAPIParams, traceWI } from "../../../src/workspace/gitpod-server-impl";
import { TraceContext, TraceContextWithSpan } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { GitpodClient, User, Team, Permission, ClientHeaderFields } from "@gitpod/gitpod-protocol";
import { ResponseError } from "vscode-jsonrpc";
import { AdmissionLevel, ControlAdmissionRequest } from "@gitpod/ws-manager/lib";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { GuardedCostCenter, ResourceAccessGuard, ResourceAccessOp } from "../../../src/auth/resource-access";
import { CostCenterJSON, ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import {
    CostCenter,
    CostCenter_BillingStrategy,
    ListUsageRequest_Ordering,
    UsageServiceClient,
    Usage_Kind,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { StripeService } from "../user/stripe-service";

import { Config } from "../../../src/config";
import { ClientMetadata } from "../../../src/websocket/websocket-connection-manager";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { EntitlementService } from "../../../src/billing/entitlement-service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { BillingModes } from "../billing/billing-mode";
import { UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import {
    BillingServiceClient,
    BillingServiceDefinition,
    StripeCustomer,
} from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { ClientError } from "nice-grpc-common";

@injectable()
export class GitpodServerEEImpl extends GitpodServerImpl {
    // per-user state
    @inject(StripeService) protected readonly stripeService: StripeService;

    @inject(Config) protected readonly config: Config;

    @inject(UsageServiceDefinition.name)
    protected readonly usageService: UsageServiceClient;

    @inject(EntitlementService) protected readonly entitlementService: EntitlementService;

    @inject(BillingModes) protected readonly billingModes: BillingModes;

    @inject(BillingServiceDefinition.name)
    protected readonly billingService: BillingServiceClient;

    initialize(
        client: GitpodClient | undefined,
        user: User | undefined,
        accessGuard: ResourceAccessGuard,
        clientMetadata: ClientMetadata,
        connectionCtx: TraceContext | undefined,
        clientHeaderFields: ClientHeaderFields,
    ): void {
        super.initialize(client, user, accessGuard, clientMetadata, connectionCtx, clientHeaderFields);
    }

    public async controlAdmission(ctx: TraceContext, workspaceId: string, level: "owner" | "everyone"): Promise<void> {
        traceAPIParams(ctx, { workspaceId, level });
        traceWI(ctx, { workspaceId });

        this.checkAndBlockUser("controlAdmission");

        const lvlmap = new Map<string, AdmissionLevel>();
        lvlmap.set("owner", AdmissionLevel.ADMIT_OWNER_ONLY);
        lvlmap.set("everyone", AdmissionLevel.ADMIT_EVERYONE);
        if (!lvlmap.has(level)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invalid admission level.");
        }

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");

        if (level != "owner" && workspace.organizationId) {
            const settings = await this.teamDB.findOrgSettings(workspace.organizationId);
            if (settings?.workspaceSharingDisabled) {
                throw new ResponseError(
                    ErrorCodes.PERMISSION_DENIED,
                    "An Organization Owner has disabled workspace sharing for workspaces in this Organization. ",
                );
            }
        }

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (instance) {
            await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace: workspace }, "update");

            const req = new ControlAdmissionRequest();
            req.setId(instance.id);
            req.setLevel(lvlmap.get(level)!);

            const client = await this.workspaceManagerClientProvider.get(instance.region);
            await client.controlAdmission(ctx, req);
        }

        await this.workspaceDb.trace(ctx).transaction(async (db) => {
            workspace.shareable = level === "everyone";
            await db.store(workspace);
        });
    }

    async getStripePublishableKey(ctx: TraceContext): Promise<string> {
        this.checkAndBlockUser("getStripePublishableKey");
        const publishableKey = this.config.stripeSecrets?.publishableKey;
        if (!publishableKey) {
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                "Stripe is not properly configured (no publishable key)",
            );
        }
        return publishableKey;
    }

    async getStripeSetupIntentClientSecret(ctx: TraceContext): Promise<string> {
        this.checkAndBlockUser("getStripeSetupIntentClientSecret");
        try {
            const setupIntent = await this.stripeService.createSetupIntent();
            if (!setupIntent.client_secret) {
                throw new Error("No client secret in the SetupIntent");
            }
            return setupIntent.client_secret;
        } catch (error) {
            log.error("Failed to create Stripe SetupIntent", error);
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to create Stripe SetupIntent");
        }
    }

    async findStripeSubscriptionId(ctx: TraceContext, attributionId: string): Promise<string | undefined> {
        const user = this.checkAndBlockUser("findStripeSubscriptionId");

        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        try {
            if (attrId.kind == "team") {
                await this.guardTeamOperation(attrId.teamId, "get", "not_implemented");
            } else {
                if (attrId.userId !== user.id) {
                    throw new ResponseError(
                        ErrorCodes.PERMISSION_DENIED,
                        "Cannot get subscription id for another user",
                    );
                }
            }
            const subscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(attributionId);
            return subscriptionId;
        } catch (error) {
            log.error(`Failed to get Stripe Subscription ID for '${attributionId}'`, error);
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to get Stripe Subscription ID for '${attributionId}'`,
            );
        }
    }

    async getPriceInformation(ctx: TraceContext, attributionId: string): Promise<string | undefined> {
        const user = this.checkAndBlockUser("getPriceInformation");
        const attrId = AttributionId.parse(attributionId);
        if (!attrId) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attributionId '${attributionId}'`);
        }

        if (attrId.kind === "team") {
            await this.guardTeamOperation(attrId.teamId, "update", "not_implemented");
        } else {
            if (attrId.userId !== user.id) {
                throw new ResponseError(
                    ErrorCodes.PERMISSION_DENIED,
                    "Cannot get pricing information for another user",
                );
            }
        }
        return this.stripeService.getPriceInformation(attributionId);
    }

    async createStripeCustomerIfNeeded(ctx: TraceContext, attributionId: string, currency: string): Promise<void> {
        const user = this.checkAndBlockUser("createStripeCustomerIfNeeded");
        const attrId = AttributionId.parse(attributionId);
        if (!attrId) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attributionId '${attributionId}'`);
        }

        let team: Team | undefined;
        if (attrId.kind === "team") {
            team = (await this.guardTeamOperation(attrId.teamId, "update", "not_implemented")).team;
        } else {
            if (attrId.userId !== user.id) {
                throw new ResponseError(
                    ErrorCodes.PERMISSION_DENIED,
                    "Cannot create Stripe customer profile for another user",
                );
            }
        }

        const billingEmail = User.getPrimaryEmail(user);
        const billingName = attrId.kind === "team" ? team!.name : User.getName(user);

        let customer: StripeCustomer | undefined;
        try {
            customer = (await this.billingService.getStripeCustomer({ attributionId })).customer;
        } catch (e) {
            log.info(e);
        }
        if (customer) {
            // NOTE: this is a temporary workaround, as long as we're not automatically re-create the customer
            // entity on Stripe to support a switch of currencies, we're taking an exit here.
            if (customer.currency && customer.currency !== currency) {
                throw new ResponseError(
                    ErrorCodes.SUBSCRIPTION_ERROR,
                    `Your previous subscription was in ${customer.currency}. If you'd like to change currencies, please contact our support.`,
                    { hint: "currency", oldValue: customer.currency, value: currency },
                );
            }
            // customer already exists, we don't need to create a new one.
            return;
        }

        // otherwise we need to create a new customer.
        try {
            await this.billingService.createStripeCustomer({
                attributionId,
                currency,
                email: billingEmail,
                name: billingName,
                billingCreatorUserId: user.id,
            });
            return;
        } catch (error) {
            log.error(`Failed to create Stripe customer profile for '${attributionId}'`, error);
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to create Stripe customer profile for '${attributionId}'`,
            );
        }
    }

    async createHoldPaymentIntent(
        ctx: TraceContext,
        attributionId: string,
    ): Promise<{ paymentIntentId: string; paymentIntentClientSecret: string }> {
        this.checkAndBlockUser("createHoldPaymentIntent");

        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        try {
            const response = await this.billingService.createHoldPaymentIntent({ attributionId: attributionId });
            return {
                paymentIntentId: response.paymentIntentId,
                paymentIntentClientSecret: response.paymentIntentClientSecret,
            };
        } catch (error) {
            log.error(`Failed to subscribe '${attributionId}' to Stripe`, error);
            if (error instanceof ClientError) {
                throw new ResponseError(error.code, error.details);
            }
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to subscribe '${attributionId}' to Stripe`,
            );
        }
    }

    async subscribeToStripe(
        ctx: TraceContext,
        attributionId: string,
        setupIntentId: string,
        paymentIntentId: string,
        usageLimit: number,
    ): Promise<number | undefined> {
        const user = this.checkAndBlockUser("subscribeToStripe");

        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        try {
            if (attrId.kind === "team") {
                await this.guardTeamOperation(attrId.teamId, "update", "not_implemented");
            } else {
                if (attrId.userId !== user.id) {
                    throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Cannot sign up for another user");
                }
            }

            const customerId = await this.stripeService.findCustomerByAttributionId(attributionId);
            if (!customerId) {
                throw new Error(`No Stripe customer profile for '${attributionId}'`);
            }

            await this.billingService.createStripeSubscription({
                attributionId,
                setupIntentId,
                paymentIntentId,
                usageLimit,
            });

            // Creating a cost center for this customer
            const { costCenter } = await this.usageService.setCostCenter({
                costCenter: {
                    attributionId: attributionId,
                    spendingLimit: usageLimit,
                    billingStrategy: CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE,
                },
            });

            return costCenter?.spendingLimit;
        } catch (error) {
            log.error(`Failed to subscribe '${attributionId}' to Stripe`, error);
            if (error instanceof ClientError) {
                throw new ResponseError(error.code, error.details);
            }
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to subscribe '${attributionId}' to Stripe`,
            );
        }
    }

    async getStripePortalUrl(ctx: TraceContext, attributionId: string): Promise<string> {
        this.checkAndBlockUser("getStripePortalUrl");

        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        let returnUrl = this.config.hostUrl
            .with(() => ({ pathname: `/billing`, search: `org=${attrId.kind === "team" ? attrId.teamId : "0"}` }))
            .toString();
        if (attrId.kind === "user") {
            returnUrl = this.config.hostUrl.with(() => ({ pathname: `/user/billing`, search: `org=0` })).toString();
        } else if (attrId.kind === "team") {
            await this.guardTeamOperation(attrId.teamId, "update", "not_implemented");
        }
        let url: string;
        try {
            url = await this.stripeService.getPortalUrlForAttributionId(attributionId, returnUrl);
        } catch (error) {
            log.error(`Failed to get Stripe portal URL for '${attributionId}'`, error);
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to get Stripe portal URL for '${attributionId}'`,
            );
        }
        return url;
    }

    async getCostCenter(ctx: TraceContext, attributionId: string): Promise<CostCenterJSON | undefined> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const user = this.checkAndBlockUser("getCostCenter");
        await this.guardCostCenterAccess(ctx, user.id, attrId, "get");

        const { costCenter } = await this.usageService.getCostCenter({ attributionId });
        return this.translateCostCenter(costCenter);
    }

    private translateCostCenter(costCenter?: CostCenter): CostCenterJSON | undefined {
        return costCenter
            ? {
                  ...costCenter,
                  billingCycleStart: costCenter.billingCycleStart
                      ? costCenter.billingCycleStart.toISOString()
                      : undefined,
                  nextBillingTime: costCenter.nextBillingTime ? costCenter.nextBillingTime.toISOString() : undefined,
              }
            : undefined;
    }

    async setUsageLimit(ctx: TraceContext, attributionId: string, usageLimit: number): Promise<void> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }
        if (typeof usageLimit !== "number" || usageLimit < 0) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Unexpected usageLimit value: ${usageLimit}`);
        }
        const user = this.checkAndBlockUser("setUsageLimit");
        await this.guardCostCenterAccess(ctx, user.id, attrId, "update");

        const response = await this.usageService.getCostCenter({ attributionId });

        // backward compatibility for cost centers that were created before introduction of BillingStrategy
        if (response.costCenter) {
            const stripeSubscriptionId = await this.findStripeSubscriptionId(ctx, attributionId);
            if (stripeSubscriptionId != undefined) {
                response.costCenter.billingStrategy = CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
            }
        }

        if (response.costCenter?.billingStrategy !== CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE) {
            throw new ResponseError(
                ErrorCodes.BAD_REQUEST,
                `Setting a usage limit is not valid for non-Stripe billing strategies`,
            );
        }
        await this.usageService.setCostCenter({
            costCenter: {
                attributionId,
                spendingLimit: usageLimit,
                billingStrategy: response.costCenter.billingStrategy,
            },
        });
    }

    async listUsage(ctx: TraceContext, req: ListUsageRequest): Promise<ListUsageResponse> {
        const attributionId = AttributionId.parse(req.attributionId);
        if (!attributionId) {
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "Bad attribution ID", {
                attributionId: req.attributionId,
            });
        }
        const user = this.checkAndBlockUser("listUsage");
        await this.guardCostCenterAccess(ctx, user.id, attributionId, "get");
        return this.internalListUsage(ctx, req);
    }

    async getUsageBalance(ctx: TraceContext, attributionId: string): Promise<number> {
        const user = this.checkAndBlockUser("listUsage");
        const parsedAttributionId = AttributionId.parse(attributionId);
        if (!parsedAttributionId) {
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "Bad attribution ID", {
                attributionId,
            });
        }
        await this.guardCostCenterAccess(ctx, user.id, parsedAttributionId, "get");
        const result = await this.usageService.getBalance({ attributionId });
        return result.credits;
    }

    private async internalListUsage(ctx: TraceContext, req: ListUsageRequest): Promise<ListUsageResponse> {
        const { from, to } = req;
        const attributionId = AttributionId.parse(req.attributionId);
        if (!attributionId) {
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "Bad attribution ID", {
                attributionId: req.attributionId,
            });
        }
        traceAPIParams(ctx, { attributionId });
        const response = await this.usageService.listUsage({
            attributionId: AttributionId.render(attributionId),
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
        };
    }

    protected async guardCostCenterAccess(
        ctx: TraceContext,
        userId: string,
        attributionId: AttributionId,
        operation: ResourceAccessOp,
    ): Promise<void> {
        traceAPIParams(ctx, { userId, attributionId });

        let owner: GuardedCostCenter["owner"];
        switch (attributionId.kind) {
            case "team":
                const team = await this.teamDB.findTeamById(attributionId.teamId);
                if (!team) {
                    throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
                }
                const members = await this.teamDB.findMembersByTeam(team.id);
                owner = { kind: "team", team, members };
                break;
            case "user":
                owner = { kind: "user", userId };
                break;
            default:
                throw new ResponseError(ErrorCodes.BAD_REQUEST, "Invalid attributionId");
        }

        await this.guardAccess({ kind: "costCenter", /*subject: costCenter,*/ owner }, operation);
    }

    async getBillingModeForUser(ctx: TraceContextWithSpan): Promise<BillingMode> {
        traceAPIParams(ctx, {});

        const user = this.checkUser("getBillingModeForUser");
        return this.billingModes.getBillingModeForUser(user, new Date());
    }

    async getBillingModeForTeam(ctx: TraceContextWithSpan, teamId: string): Promise<BillingMode> {
        traceAPIParams(ctx, { teamId });

        this.checkAndBlockUser("getBillingModeForTeam");
        const { team } = await this.guardTeamOperation(teamId, "get", "not_implemented");

        return this.billingModes.getBillingModeForTeam(team, new Date());
    }

    // (SaaS) – admin
    async adminGetBillingMode(ctx: TraceContextWithSpan, attributionId: string): Promise<BillingMode> {
        traceAPIParams(ctx, { attributionId });

        const user = this.checkAndBlockUser("adminGetBillingMode");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        const parsedAttributionId = AttributionId.parse(attributionId);
        if (!parsedAttributionId) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Unable to parse attributionId");
        }
        return this.billingModes.getBillingMode(parsedAttributionId, new Date());
    }

    async adminGetCostCenter(ctx: TraceContext, attributionId: string): Promise<CostCenterJSON | undefined> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const user = this.checkAndBlockUser("adminGetCostCenter");
        await this.guardAdminAccess("adminGetCostCenter", { id: user.id }, Permission.ADMIN_USERS);

        const { costCenter } = await this.usageService.getCostCenter({ attributionId });
        return this.translateCostCenter(costCenter);
    }

    async adminSetUsageLimit(ctx: TraceContext, attributionId: string, usageLimit: number): Promise<void> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }
        if (typeof usageLimit !== "number" || usageLimit < 0) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Unexpected usageLimit value: ${usageLimit}`);
        }
        const user = this.checkAndBlockUser("adminSetUsageLimit");
        await this.guardAdminAccess("adminSetUsageLimit", { id: user.id }, Permission.ADMIN_USERS);

        const response = await this.usageService.getCostCenter({ attributionId });

        // backward compatibility for cost centers that were created before introduction of BillingStrategy
        if (!response.costCenter) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Coudln't find cost center with id ${attributionId}`);
        }
        const stripeSubscriptionId = await this.findStripeSubscriptionId(ctx, attributionId);
        if (stripeSubscriptionId != undefined) {
            response.costCenter.billingStrategy = CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
        }

        await this.usageService.setCostCenter({
            costCenter: {
                attributionId,
                spendingLimit: usageLimit,
                billingStrategy: response.costCenter.billingStrategy,
            },
        });
    }

    async adminListUsage(ctx: TraceContext, req: ListUsageRequest): Promise<ListUsageResponse> {
        traceAPIParams(ctx, { req });
        const user = this.checkAndBlockUser("adminListUsage");
        await this.guardAdminAccess("adminListUsage", { id: user.id }, Permission.ADMIN_USERS);
        return this.internalListUsage(ctx, req);
    }

    async adminGetUsageBalance(ctx: TraceContext, attributionId: string): Promise<number> {
        traceAPIParams(ctx, { attributionId });
        const user = this.checkAndBlockUser("adminGetUsageBalance");
        await this.guardAdminAccess("adminGetUsageBalance", { id: user.id }, Permission.ADMIN_USERS);
        const result = await this.usageService.getBalance({ attributionId });
        return result.credits;
    }

    async adminAddUsageCreditNote(
        ctx: TraceContext,
        attributionId: string,
        credits: number,
        description: string,
    ): Promise<void> {
        traceAPIParams(ctx, { attributionId, credits, note: description });
        const user = this.checkAndBlockUser("adminAddUsageCreditNote");
        await this.guardAdminAccess("adminAddUsageCreditNote", { id: user.id }, Permission.ADMIN_USERS);
        await this.usageService.addUsageCreditNote({
            attributionId,
            credits,
            description,
            userId: user.id,
        });
    }
}

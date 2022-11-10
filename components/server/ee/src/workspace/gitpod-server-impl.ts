/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { GitpodServerImpl, traceAPIParams, traceWI, censor } from "../../../src/workspace/gitpod-server-impl";
import { TraceContext, TraceContextWithSpan } from "@gitpod/gitpod-protocol/lib/util/tracing";
import {
    GitpodServer,
    GitpodClient,
    AdminGetListRequest,
    User,
    Team,
    TeamMemberInfo,
    AdminGetListResult,
    Permission,
    AdminBlockUserRequest,
    AdminModifyRoleOrPermissionRequest,
    RoleOrPermission,
    AdminModifyPermanentWorkspaceFeatureFlagRequest,
    UserFeatureSettings,
    AdminGetWorkspacesRequest,
    WorkspaceAndInstance,
    GetWorkspaceTimeoutResult,
    WorkspaceTimeoutDuration,
    WorkspaceTimeoutValues,
    SetWorkspaceTimeoutResult,
    WorkspaceContext,
    WorkspaceCreationResult,
    PrebuiltWorkspaceContext,
    CommitContext,
    PrebuiltWorkspace,
    WorkspaceInstance,
    EduEmailDomain,
    ProviderRepository,
    Queue,
    PrebuildWithStatus,
    CreateProjectParams,
    Project,
    StartPrebuildResult,
    ClientHeaderFields,
    Workspace,
    FindPrebuildsParams,
    TeamMemberRole,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    PrebuildEvent,
    OpenPrebuildContext,
} from "@gitpod/gitpod-protocol";
import { ResponseError } from "vscode-jsonrpc";
import {
    TakeSnapshotRequest,
    AdmissionLevel,
    ControlAdmissionRequest,
    StopWorkspacePolicy,
    DescribeWorkspaceRequest,
    SetTimeoutRequest,
} from "@gitpod/ws-manager/lib";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { v4 as uuidv4 } from "uuid";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { LicenseKeySource } from "@gitpod/licensor/lib";
import { Feature } from "@gitpod/licensor/lib/api";
import { LicenseValidationResult, LicenseFeature } from "@gitpod/gitpod-protocol/lib/license-protocol";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { LicenseDB } from "@gitpod/gitpod-db/lib";
import { GuardedCostCenter, ResourceAccessGuard, ResourceAccessOp } from "../../../src/auth/resource-access";
import { AccountStatement, CreditAlert, Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import { EligibilityService } from "../user/eligibility-service";
import { AccountStatementProvider } from "../user/account-statement-provider";
import { GithubUpgradeURL, PlanCoupon } from "@gitpod/gitpod-protocol/lib/payment-protocol";
import { ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import {
    CostCenter_BillingStrategy,
    ListUsageRequest_Ordering,
    UsageServiceClient,
    Usage_Kind,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import {
    AssigneeIdentityIdentifier,
    TeamSubscription,
    TeamSubscription2,
    TeamSubscriptionSlot,
    TeamSubscriptionSlotResolved,
} from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import * as pThrottle from "p-throttle";
import { formatDate } from "@gitpod/gitpod-protocol/lib/util/date-time";
import { FindUserByIdentityStrResult, UserService } from "../../../src/user/user-service";
import {
    AccountService,
    SubscriptionService,
    TeamSubscriptionService,
    TeamSubscription2Service,
} from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { AccountingDB, TeamSubscriptionDB, TeamSubscription2DB, EduEmailDomainDB } from "@gitpod/gitpod-db/lib";
import { ChargebeeProvider, UpgradeHelper } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";
import { ChargebeeCouponComputer } from "../user/coupon-computer";
import { ChargebeeService } from "../user/chargebee-service";
import { Chargebee as chargebee } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";
import { StripeService } from "../user/stripe-service";

import { GitHubAppSupport } from "../github/github-app-support";
import { GitLabAppSupport } from "../gitlab/gitlab-app-support";
import { Config } from "../../../src/config";
import { SnapshotService, WaitForSnapshotOptions } from "./snapshot-service";
import { ClientMetadata, traceClientMetadata } from "../../../src/websocket/websocket-connection-manager";
import { BitbucketAppSupport } from "../bitbucket/bitbucket-app-support";
import { URL } from "url";
import { UserCounter } from "../user/user-counter";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { EntitlementService, MayStartWorkspaceResult } from "../../../src/billing/entitlement-service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { BillingModes } from "../billing/billing-mode";
import { UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { BillingServiceClient, BillingServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { IncrementalPrebuildsService } from "../prebuilds/incremental-prebuilds-service";
import { ConfigProvider } from "../../../src/workspace/config-provider";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

@injectable()
export class GitpodServerEEImpl extends GitpodServerImpl {
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(IncrementalPrebuildsService) protected readonly incrementalPrebuildsService: IncrementalPrebuildsService;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;
    @inject(LicenseDB) protected readonly licenseDB: LicenseDB;
    @inject(LicenseKeySource) protected readonly licenseKeySource: LicenseKeySource;

    // per-user state
    @inject(EligibilityService) protected readonly eligibilityService: EligibilityService;
    @inject(AccountStatementProvider) protected readonly accountStatementProvider: AccountStatementProvider;

    @inject(AccountService) protected readonly accountService: AccountService;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(AccountingDB) protected readonly accountingDB: AccountingDB;
    @inject(EduEmailDomainDB) protected readonly eduDomainDb: EduEmailDomainDB;

    @inject(TeamSubscription2DB) protected readonly teamSubscription2DB: TeamSubscription2DB;
    @inject(TeamSubscriptionDB) protected readonly teamSubscriptionDB: TeamSubscriptionDB;
    @inject(TeamSubscriptionService) protected readonly teamSubscriptionService: TeamSubscriptionService;
    @inject(TeamSubscription2Service) protected readonly teamSubscription2Service: TeamSubscription2Service;

    @inject(ChargebeeProvider) protected readonly chargebeeProvider: ChargebeeProvider;
    @inject(UpgradeHelper) protected readonly upgradeHelper: UpgradeHelper;
    @inject(ChargebeeCouponComputer) protected readonly couponComputer: ChargebeeCouponComputer;
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;
    @inject(StripeService) protected readonly stripeService: StripeService;

    @inject(GitHubAppSupport) protected readonly githubAppSupport: GitHubAppSupport;
    @inject(GitLabAppSupport) protected readonly gitLabAppSupport: GitLabAppSupport;
    @inject(BitbucketAppSupport) protected readonly bitbucketAppSupport: BitbucketAppSupport;

    @inject(Config) protected readonly config: Config;

    @inject(SnapshotService) protected readonly snapshotService: SnapshotService;

    @inject(UserCounter) protected readonly userCounter: UserCounter;

    @inject(UserService) protected readonly userService: UserService;

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

        this.listenToCreditAlerts();
        this.listenForPrebuildUpdates().catch((err) => log.error("error registering for prebuild updates", err));
        this.listenForSubscriptionUpdates().catch((err) => log.error("error registering for prebuild updates", err));
    }

    protected async listenForPrebuildUpdates() {
        // 'registering for prebuild updates for all projects this user has access to
        const projects = await this.getAccessibleProjects();
        for (const projectId of projects) {
            this.disposables.push(
                this.localMessageBroker.listenForPrebuildUpdates(
                    projectId,
                    (ctx: TraceContext, update: PrebuildWithStatus) =>
                        TraceContext.withSpan(
                            "forwardPrebuildUpdateToClient",
                            (ctx) => {
                                traceClientMetadata(ctx, this.clientMetadata);
                                TraceContext.setJsonRPCMetadata(ctx, "onPrebuildUpdate");

                                this.client?.onPrebuildUpdate(update);
                            },
                            ctx,
                        ),
                ),
            );
        }

        // TODO(at) we need to keep the list of accessible project up to date
    }

    protected async listenForSubscriptionUpdates() {
        if (!this.user) {
            return;
        }
        const teamIds = (await this.teamDB.findTeamsByUser(this.user.id)).map(({ id }) =>
            AttributionId.render({ kind: "team", teamId: id }),
        );
        for (const attributionId of [AttributionId.render({ kind: "user", userId: this.user.id }), ...teamIds]) {
            this.disposables.push(
                this.localMessageBroker.listenForSubscriptionUpdates(
                    attributionId,
                    (ctx: TraceContext, attributionId: AttributionId) =>
                        TraceContext.withSpan(
                            "forwardSubscriptionUpdateToClient",
                            (ctx) => {
                                traceClientMetadata(ctx, this.clientMetadata);
                                TraceContext.setJsonRPCMetadata(ctx, "onSubscriptionUpdate");
                                this.client?.onNotificationUpdated();
                            },
                            ctx,
                        ),
                ),
            );
        }
    }

    protected async getAccessibleProjects() {
        if (!this.user) {
            return [];
        }

        // update all project this user has access to
        const allProjects: string[] = [];
        const teams = await this.teamDB.findTeamsByUser(this.user.id);
        for (const team of teams) {
            allProjects.push(...(await this.projectsService.getTeamProjects(team.id)).map((p) => p.id));
        }
        allProjects.push(...(await this.projectsService.getUserProjects(this.user.id)).map((p) => p.id));
        return allProjects;
    }

    /**
     * todo: the credit alert parts are migrated, but remain unused
     */
    protected listenToCreditAlerts(): void {
        if (!this.user || !this.client) {
            return;
        }
        this.disposables.push(
            this.localMessageBroker.listenToCreditAlerts(
                this.user.id,
                (ctx: TraceContext, creditAlert: CreditAlert) => {
                    TraceContext.withSpan(
                        "forwardCreditAlertToClient",
                        async (ctx) => {
                            traceClientMetadata(ctx, this.clientMetadata);
                            TraceContext.setJsonRPCMetadata(ctx, "onCreditAlert");

                            this.client?.onCreditAlert(creditAlert);
                            if (creditAlert.remainingUsageHours < 1e-6) {
                                const runningInstances = await this.workspaceDb
                                    .trace(ctx)
                                    .findRegularRunningInstances(creditAlert.userId);
                                runningInstances.forEach(
                                    async (instance) => await this.stopWorkspace(ctx, instance.workspaceId),
                                );
                            }
                        },
                        ctx,
                    );
                },
            ),
        );
    }

    protected async mayStartWorkspace(
        ctx: TraceContext,
        user: User,
        workspace: Workspace,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<void> {
        await super.mayStartWorkspace(ctx, user, workspace, runningInstances);

        let result: MayStartWorkspaceResult = {};
        try {
            result = await this.entitlementService.mayStartWorkspace(user, workspace, new Date(), runningInstances);
            TraceContext.addNestedTags(ctx, { mayStartWorkspace: { result } });
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementSerivce.mayStartWorkspace error", err);
            TraceContext.setError(ctx, err);
            return; // we don't want to block workspace starts because of internal errors
        }
        if (!!result.needsVerification) {
            throw new ResponseError(ErrorCodes.NEEDS_VERIFICATION, `Please verify your account.`);
        }
        if (!!result.oufOfCredits) {
            throw new ResponseError(
                ErrorCodes.NOT_ENOUGH_CREDIT,
                `Not enough monthly workspace hours. Please upgrade your account to get more hours for your workspaces.`,
            );
        }
        if (!!result.usageLimitReachedOnCostCenter) {
            throw new ResponseError(ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED, "Increase usage limit and try again.", {
                attributionId: result.usageLimitReachedOnCostCenter,
            });
        }
        if (!!result.hitParallelWorkspaceLimit) {
            throw new ResponseError(
                ErrorCodes.TOO_MANY_RUNNING_WORKSPACES,
                `You cannot run more than ${result.hitParallelWorkspaceLimit.max} workspaces at the same time. Please stop a workspace before starting another one.`,
            );
        }
    }

    protected async requireEELicense(feature: Feature) {
        const cachedUserCount = this.userCounter.count;

        let userCount: number;
        if (cachedUserCount === null) {
            userCount = await this.userDB.getUserCount(true);
            this.userCounter.count = userCount;
        } else {
            userCount = cachedUserCount;
        }

        if (!this.licenseEvaluator.isEnabled(feature, userCount)) {
            throw new ResponseError(ErrorCodes.EE_LICENSE_REQUIRED, "enterprise license required");
        }
    }

    async validateLicense(ctx: TraceContext): Promise<LicenseValidationResult> {
        const v = this.licenseEvaluator.validate();
        if (!v.valid) {
            return v;
        }

        const userCount = await this.userDB.getUserCount(true);
        const canAnotherUserSignUp = this.licenseEvaluator.hasEnoughSeats(userCount + 1);
        if (!canAnotherUserSignUp) {
            return {
                valid: true,
                issue: "seats-exhausted",
                msg: "maximum number of users reached",
            };
        }

        return { valid: true };
    }

    public async setWorkspaceTimeout(
        ctx: TraceContext,
        workspaceId: string,
        duration: WorkspaceTimeoutDuration,
    ): Promise<SetWorkspaceTimeoutResult> {
        traceAPIParams(ctx, { workspaceId, duration });
        traceWI(ctx, { workspaceId });

        await this.requireEELicense(Feature.FeatureSetTimeout);
        const user = this.checkUser("setWorkspaceTimeout");

        if (!WorkspaceTimeoutValues.includes(duration)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Invalid duration");
        }

        if (!(await this.maySetTimeout(user))) {
            throw new ResponseError(ErrorCodes.PLAN_PROFESSIONAL_REQUIRED, "Plan upgrade is required");
        }

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        const runningInstances = await this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
        const runningInstance = runningInstances.find((i) => i.workspaceId === workspaceId);
        if (!runningInstance) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Can only set keep-alive for running workspaces");
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "update");

        // if any other running instance has a custom timeout other than the user's default, we'll reset that timeout
        const client = await this.workspaceManagerClientProvider.get(
            runningInstance.region,
            this.config.installationShortname,
        );
        const defaultTimeout = await this.entitlementService.getDefaultWorkspaceTimeout(user, new Date());
        const instancesWithReset = runningInstances.filter(
            (i) => i.workspaceId !== workspaceId && i.status.timeout !== defaultTimeout && i.status.phase === "running",
        );
        await Promise.all(
            instancesWithReset.map(async (i) => {
                const req = new SetTimeoutRequest();
                req.setId(i.id);
                req.setDuration(this.userService.workspaceTimeoutToDuration(defaultTimeout));

                const client = await this.workspaceManagerClientProvider.get(
                    i.region,
                    this.config.installationShortname,
                );
                return client.setTimeout(ctx, req);
            }),
        );

        const req = new SetTimeoutRequest();
        req.setId(runningInstance.id);
        req.setDuration(this.userService.workspaceTimeoutToDuration(duration));
        await client.setTimeout(ctx, req);

        return {
            resetTimeoutOnWorkspaces: instancesWithReset.map((i) => i.workspaceId),
        };
    }

    public async getWorkspaceTimeout(ctx: TraceContext, workspaceId: string): Promise<GetWorkspaceTimeoutResult> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        // Allowed in the free version, because it is read only.
        // this.requireEELicense(Feature.FeatureSetTimeout);

        const user = this.checkUser("getWorkspaceTimeout");

        const canChange = await this.maySetTimeout(user);

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        const runningInstance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!runningInstance) {
            log.warn({ userId: user.id, workspaceId }, "Can only get keep-alive for running workspaces");
            const duration = WORKSPACE_TIMEOUT_DEFAULT_SHORT;
            return { duration, durationRaw: this.userService.workspaceTimeoutToDuration(duration), canChange };
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "get");

        const req = new DescribeWorkspaceRequest();
        req.setId(runningInstance.id);

        const client = await this.workspaceManagerClientProvider.get(
            runningInstance.region,
            this.config.installationShortname,
        );
        const desc = await client.describeWorkspace(ctx, req);
        const duration = this.userService.durationToWorkspaceTimeout(desc.getStatus()!.getSpec()!.getTimeout());
        const durationRaw = this.userService.workspaceTimeoutToDuration(duration);

        return { duration, durationRaw, canChange };
    }

    public async isPrebuildDone(ctx: TraceContext, pwsId: string): Promise<boolean> {
        traceAPIParams(ctx, { pwsId });

        // Allowed in the free version, because it is read only.
        // this.requireEELicense(Feature.FeaturePrebuild);

        const pws = await this.workspaceDb.trace(ctx).findPrebuildByID(pwsId);
        if (!pws) {
            // there is no prebuild - that's as good one being done
            return true;
        }

        return PrebuiltWorkspace.isDone(pws);
    }

    /**
     * gitpod.io Extension point for implementing eligibility checks. Throws a ResponseError if not eligible.
     */
    protected async maySetTimeout(user: User): Promise<boolean> {
        return this.entitlementService.maySetTimeout(user, new Date());
    }

    public async controlAdmission(ctx: TraceContext, workspaceId: string, level: "owner" | "everyone"): Promise<void> {
        traceAPIParams(ctx, { workspaceId, level });
        traceWI(ctx, { workspaceId });

        await this.requireEELicense(Feature.FeatureWorkspaceSharing);
        this.checkAndBlockUser("controlAdmission");

        const lvlmap = new Map<string, AdmissionLevel>();
        lvlmap.set("owner", AdmissionLevel.ADMIT_OWNER_ONLY);
        lvlmap.set("everyone", AdmissionLevel.ADMIT_EVERYONE);
        if (!lvlmap.has(level)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invalid admission level.");
        }

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (instance) {
            await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace: workspace }, "update");

            const req = new ControlAdmissionRequest();
            req.setId(instance.id);
            req.setLevel(lvlmap.get(level)!);

            const client = await this.workspaceManagerClientProvider.get(
                instance.region,
                this.config.installationShortname,
            );
            await client.controlAdmission(ctx, req);
        }

        await this.workspaceDb.trace(ctx).transaction(async (db) => {
            workspace.shareable = level === "everyone";
            await db.store(workspace);
        });
    }

    async takeSnapshot(ctx: TraceContext, options: GitpodServer.TakeSnapshotOptions): Promise<string> {
        traceAPIParams(ctx, { options });
        const { workspaceId, dontWait } = options;
        traceWI(ctx, { workspaceId });

        await this.requireEELicense(Feature.FeatureSnapshot);
        const user = this.checkAndBlockUser("takeSnapshot");

        const workspace = await this.guardSnaphotAccess(ctx, user.id, workspaceId);

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!instance) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace }, "get");

        const client = await this.workspaceManagerClientProvider.get(
            instance.region,
            this.config.installationShortname,
        );
        const request = new TakeSnapshotRequest();
        request.setId(instance.id);
        request.setReturnImmediately(true);

        // this triggers the snapshots, but returns early! cmp. waitForSnapshot to wait for it's completion
        const resp = await client.takeSnapshot(ctx, request);

        const snapshot = await this.snapshotService.createSnapshot(options, resp.getUrl());

        // to be backwards compatible during rollout, we require new clients to explicitly pass "dontWait: true"
        const waitOpts = { workspaceOwner: workspace.ownerId, snapshot };
        if (!dontWait) {
            // this mimicks the old behavior: wait until the snapshot is through
            await this.internalDoWaitForWorkspace(waitOpts);
        } else {
            // start driving the snapshot immediately
            this.internalDoWaitForWorkspace(waitOpts).catch((err) =>
                log.error({ userId: user.id, workspaceId: workspaceId }, "internalDoWaitForWorkspace", err),
            );
        }

        return snapshot.id;
    }

    protected async guardSnaphotAccess(ctx: TraceContext, userId: string, workspaceId: string): Promise<Workspace> {
        traceAPIParams(ctx, { userId, workspaceId });

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace || workspace.ownerId !== userId) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
        }
        await this.guardAccess({ kind: "snapshot", subject: undefined, workspace }, "create");

        return workspace;
    }

    /**
     * @param snapshotId
     * @throws ResponseError with either NOT_FOUND or SNAPSHOT_ERROR in case the snapshot is not done yet.
     */
    async waitForSnapshot(ctx: TraceContext, snapshotId: string): Promise<void> {
        traceAPIParams(ctx, { snapshotId });

        await this.requireEELicense(Feature.FeatureSnapshot);
        const user = this.checkAndBlockUser("waitForSnapshot");

        const snapshot = await this.workspaceDb.trace(ctx).findSnapshotById(snapshotId);
        if (!snapshot) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `No snapshot with id '${snapshotId}' found.`);
        }
        const snapshotWorkspace = await this.guardSnaphotAccess(ctx, user.id, snapshot.originalWorkspaceId);
        await this.internalDoWaitForWorkspace({ workspaceOwner: snapshotWorkspace.ownerId, snapshot });
    }

    protected async internalDoWaitForWorkspace(opts: WaitForSnapshotOptions) {
        try {
            await this.snapshotService.waitForSnapshot(opts);
        } catch (err) {
            // wrap in SNAPSHOT_ERROR to signal this call should not be retried.
            throw new ResponseError(ErrorCodes.SNAPSHOT_ERROR, err.toString());
        }
    }

    async getSnapshots(ctx: TraceContext, workspaceId: string): Promise<string[]> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        // Allowed in the free version, because it is read only.
        // this.requireEELicense(Feature.FeatureSnapshot);

        const user = this.checkAndBlockUser("getSnapshots");

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace || workspace.ownerId !== user.id) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
        }

        const snapshots = await this.workspaceDb.trace(ctx).findSnapshotsByWorkspaceId(workspaceId);
        await Promise.all(snapshots.map((s) => this.guardAccess({ kind: "snapshot", subject: s, workspace }, "get")));

        return snapshots.map((s) => s.id);
    }

    async adminGetUsers(ctx: TraceContext, req: AdminGetListRequest<User>): Promise<AdminGetListResult<User>> {
        traceAPIParams(ctx, { req: censor(req, "searchTerm") }); // searchTerm may contain PII

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetUsers", { req }, Permission.ADMIN_USERS);

        try {
            const res = await this.userDB.findAllUsers(
                req.offset,
                req.limit,
                req.orderBy,
                req.orderDir === "asc" ? "ASC" : "DESC",
                req.searchTerm,
            );
            res.rows = res.rows.map(this.censorUser);
            return res;
        } catch (e) {
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }
    }

    async adminGetUser(ctx: TraceContext, userId: string): Promise<User> {
        traceAPIParams(ctx, { userId });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetUser", { id: userId }, Permission.ADMIN_USERS);

        let result: User | undefined;
        try {
            result = await this.userDB.findUserById(userId);
        } catch (e) {
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }

        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }
        return this.censorUser(result);
    }

    async adminBlockUser(ctx: TraceContext, req: AdminBlockUserRequest): Promise<User> {
        traceAPIParams(ctx, { req });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminBlockUser", { req }, Permission.ADMIN_USERS);

        let targetUser;
        try {
            targetUser = await this.userService.blockUser(req.id, req.blocked);
        } catch (error) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }

        const workspaceDb = this.workspaceDb.trace(ctx);
        const workspaces = await workspaceDb.findWorkspacesByUser(req.id);
        const isDefined = <T>(x: T | undefined): x is T => x !== undefined;
        (await Promise.all(workspaces.map((workspace) => workspaceDb.findRunningInstance(workspace.id))))
            .filter(isDefined)
            .forEach((instance) =>
                this.workspaceStarter.stopWorkspaceInstance(
                    ctx,
                    instance.id,
                    instance.region,
                    "user blocked by admin",
                    StopWorkspacePolicy.IMMEDIATELY,
                ),
            );

        // For some reason, returning the result of `this.userDB.storeUser(target)` does not work. The response never arrives the caller.
        // Returning `target` instead (which should be equivalent).
        return this.censorUser(targetUser);
    }

    async adminVerifyUser(ctx: TraceContext, userId: string): Promise<User> {
        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminVerifyUser", { id: userId }, Permission.ADMIN_USERS);
        try {
            const user = await this.userDB.findUserById(userId);
            if (!user) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, `No user with id ${userId} found.`);
            }
            this.verificationService.markVerified(user);
            await this.userDB.updateUserPartial(user);
            return user;
        } catch (e) {
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }
    }

    async adminDeleteUser(ctx: TraceContext, userId: string): Promise<void> {
        traceAPIParams(ctx, { userId });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminDeleteUser", { id: userId }, Permission.ADMIN_USERS);

        try {
            await this.userDeletionService.deleteUser(userId);
        } catch (e) {
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }
    }

    async adminGetBlockedRepositories(
        ctx: TraceContext,
        req: AdminGetListRequest<BlockedRepository>,
    ): Promise<AdminGetListResult<BlockedRepository>> {
        traceAPIParams(ctx, { req: censor(req, "searchTerm") }); // searchTerm may contain PII
        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetBlockedRepositories", { req }, Permission.ADMIN_USERS);

        try {
            const res = await this.blockedRepostoryDB.findAllBlockedRepositories(
                req.offset,
                req.limit,
                req.orderBy,
                req.orderDir === "asc" ? "ASC" : "DESC",
                req.searchTerm,
            );
            return res;
        } catch (e) {
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }
    }

    async adminCreateBlockedRepository(
        ctx: TraceContext,
        urlRegexp: string,
        blockUser: boolean,
    ): Promise<BlockedRepository> {
        traceAPIParams(ctx, { urlRegexp, blockUser });
        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminCreateBlockedRepository", { urlRegexp, blockUser }, Permission.ADMIN_USERS);

        return await this.blockedRepostoryDB.createBlockedRepository(urlRegexp, blockUser);
    }

    async adminDeleteBlockedRepository(ctx: TraceContext, id: number): Promise<void> {
        traceAPIParams(ctx, { id });
        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminDeleteBlockedRepository", { id }, Permission.ADMIN_USERS);

        await this.blockedRepostoryDB.deleteBlockedRepository(id);
    }

    async adminModifyRoleOrPermission(ctx: TraceContext, req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        traceAPIParams(ctx, { req });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminModifyRoleOrPermission", { req }, Permission.ADMIN_USERS);

        const target = await this.userDB.findUserById(req.id);
        if (!target) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }

        const rolesOrPermissions = new Set((target.rolesOrPermissions || []) as string[]);
        req.rpp.forEach((e) => {
            if (e.add) {
                rolesOrPermissions.add(e.r as string);
            } else {
                rolesOrPermissions.delete(e.r as string);
            }
        });
        target.rolesOrPermissions = Array.from(rolesOrPermissions.values()) as RoleOrPermission[];

        await this.userDB.storeUser(target);
        // For some reason, neither returning the result of `this.userDB.storeUser(target)` nor returning `target` work.
        // The response never arrives the caller.
        // Returning the following works at the cost of an additional DB query:
        return this.censorUser((await this.userDB.findUserById(req.id))!);
    }

    async adminModifyPermanentWorkspaceFeatureFlag(
        ctx: TraceContext,
        req: AdminModifyPermanentWorkspaceFeatureFlagRequest,
    ): Promise<User> {
        traceAPIParams(ctx, { req });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminModifyPermanentWorkspaceFeatureFlag", { req }, Permission.ADMIN_USERS);
        const target = await this.userDB.findUserById(req.id);
        if (!target) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }

        const featureSettings: UserFeatureSettings = target.featureFlags || {};
        const featureFlags = new Set(featureSettings.permanentWSFeatureFlags || []);

        req.changes.forEach((e) => {
            if (e.add) {
                featureFlags.add(e.featureFlag);
            } else {
                featureFlags.delete(e.featureFlag);
            }
        });
        featureSettings.permanentWSFeatureFlags = Array.from(featureFlags);
        target.featureFlags = featureSettings;

        await this.userDB.storeUser(target);
        // For some reason, returning the result of `this.userDB.storeUser(target)` does not work. The response never arrives the caller.
        // Returning `target` instead (which should be equivalent).
        return this.censorUser(target);
    }

    async adminGetTeamMembers(ctx: TraceContext, teamId: string): Promise<TeamMemberInfo[]> {
        await this.requireEELicense(Feature.FeatureAdminDashboard);
        await this.guardAdminAccess("adminGetTeamMembers", { teamId }, Permission.ADMIN_WORKSPACES);

        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
        }
        const members = await this.teamDB.findMembersByTeam(team.id);
        return members;
    }

    async adminGetTeams(ctx: TraceContext, req: AdminGetListRequest<Team>): Promise<AdminGetListResult<Team>> {
        await this.requireEELicense(Feature.FeatureAdminDashboard);
        await this.guardAdminAccess("adminGetTeams", { req }, Permission.ADMIN_WORKSPACES);

        return await this.teamDB.findTeams(
            req.offset,
            req.limit,
            req.orderBy,
            req.orderDir === "asc" ? "ASC" : "DESC",
            req.searchTerm as string,
        );
    }

    async adminGetTeamById(ctx: TraceContext, id: string): Promise<Team | undefined> {
        await this.requireEELicense(Feature.FeatureAdminDashboard);
        await this.guardAdminAccess("adminGetTeamById", { id }, Permission.ADMIN_WORKSPACES);
        return await this.teamDB.findTeamById(id);
    }

    async adminSetTeamMemberRole(
        ctx: TraceContext,
        teamId: string,
        userId: string,
        role: TeamMemberRole,
    ): Promise<void> {
        await this.requireEELicense(Feature.FeatureAdminDashboard);
        await this.guardAdminAccess("adminSetTeamMemberRole", { teamId, userId, role }, Permission.ADMIN_WORKSPACES);
        return this.teamDB.setTeamMemberRole(userId, teamId, role);
    }

    async adminGetWorkspaces(
        ctx: TraceContext,
        req: AdminGetWorkspacesRequest,
    ): Promise<AdminGetListResult<WorkspaceAndInstance>> {
        traceAPIParams(ctx, { req });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetWorkspaces", { req }, Permission.ADMIN_WORKSPACES);

        return await this.workspaceDb
            .trace(ctx)
            .findAllWorkspaceAndInstances(
                req.offset,
                req.limit,
                req.orderBy,
                req.orderDir === "asc" ? "ASC" : "DESC",
                req,
            );
    }

    async adminGetWorkspace(ctx: TraceContext, workspaceId: string): Promise<WorkspaceAndInstance> {
        traceAPIParams(ctx, { workspaceId });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetWorkspace", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        const result = await this.workspaceDb.trace(ctx).findWorkspaceAndInstance(workspaceId);
        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }
        return result;
    }

    async adminForceStopWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminForceStopWorkspace", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (workspace) {
            await this.internalStopWorkspace(ctx, workspace, "stopped by admin", StopWorkspacePolicy.IMMEDIATELY, true);
        }
    }

    async adminRestoreSoftDeletedWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });

        await this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess(
            "adminRestoreSoftDeletedWorkspace",
            { id: workspaceId },
            Permission.ADMIN_WORKSPACES,
        );

        await this.workspaceDb.trace(ctx).transaction(async (db) => {
            const ws = await db.findById(workspaceId);
            if (!ws) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, `No workspace with id '${workspaceId}' found.`);
            }
            if (!ws.softDeleted) {
                return;
            }
            if (!!ws.contentDeletedTime) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "The workspace content was already garbage-collected.");
            }
            // @ts-ignore
            ws.softDeleted = null;
            ws.softDeletedTime = "";
            ws.pinned = true;
            await db.store(ws);
        });
    }

    async adminGetProjectsBySearchTerm(
        ctx: TraceContext,
        req: AdminGetListRequest<Project>,
    ): Promise<AdminGetListResult<Project>> {
        await this.requireEELicense(Feature.FeatureAdminDashboard);
        await this.guardAdminAccess("adminGetProjectsBySearchTerm", { req }, Permission.ADMIN_PROJECTS);
        return await this.projectDB.findProjectsBySearchTerm(
            req.offset,
            req.limit,
            req.orderBy,
            req.orderDir === "asc" ? "ASC" : "DESC",
            req.searchTerm as string,
        );
    }

    async adminGetProjectById(ctx: TraceContext, id: string): Promise<Project | undefined> {
        await this.requireEELicense(Feature.FeatureAdminDashboard);
        await this.guardAdminAccess("adminGetProjectById", { id }, Permission.ADMIN_PROJECTS);
        return await this.projectDB.findProjectById(id);
    }

    protected async findPrebuiltWorkspace(
        parentCtx: TraceContext,
        user: User,
        context: WorkspaceContext,
        ignoreRunningPrebuild?: boolean,
        allowUsingPreviousPrebuilds?: boolean,
    ): Promise<WorkspaceCreationResult | PrebuiltWorkspaceContext | undefined> {
        const ctx = TraceContext.childContext("findPrebuiltWorkspace", parentCtx);
        try {
            if (!(CommitContext.is(context) && context.repository.cloneUrl && context.revision)) {
                return;
            }

            const commitSHAs = CommitContext.computeHash(context);

            const logCtx: LogContext = { userId: user.id };
            const cloneUrl = context.repository.cloneUrl;
            let prebuiltWorkspace: PrebuiltWorkspace | undefined;
            const logPayload = {
                allowUsingPreviousPrebuilds,
                ignoreRunningPrebuild,
                cloneUrl,
                commit: commitSHAs,
                prebuiltWorkspace,
            };
            if (OpenPrebuildContext.is(context)) {
                prebuiltWorkspace = await this.workspaceDb.trace(ctx).findPrebuildByID(context.openPrebuildID);
                if (
                    prebuiltWorkspace?.cloneURL !== cloneUrl &&
                    (ignoreRunningPrebuild || prebuiltWorkspace?.state === "available")
                ) {
                    // prevent users from opening arbitrary prebuilds this way - they must match the clone URL so that the resource guards are correct.
                    return;
                }
            } else {
                log.debug(logCtx, "Looking for prebuilt workspace: ", logPayload);
                if (!allowUsingPreviousPrebuilds) {
                    prebuiltWorkspace = await this.workspaceDb
                        .trace(ctx)
                        .findPrebuiltWorkspaceByCommit(cloneUrl, commitSHAs);
                } else {
                    const { config } = await this.configProvider.fetchConfig({}, user, context);
                    const history = await this.incrementalPrebuildsService.getCommitHistoryForContext(context, user);
                    prebuiltWorkspace = await this.incrementalPrebuildsService.findGoodBaseForIncrementalBuild(
                        context,
                        config,
                        history,
                        user,
                    );
                }
            }
            if (!prebuiltWorkspace) {
                return;
            }

            if (prebuiltWorkspace.state === "available") {
                log.info(logCtx, `Found prebuilt workspace for ${cloneUrl}:${commitSHAs}`, logPayload);
                const result: PrebuiltWorkspaceContext = {
                    title: context.title,
                    originalContext: context,
                    prebuiltWorkspace,
                };
                return result;
            } else if (prebuiltWorkspace.state === "queued" || prebuiltWorkspace.state === "building") {
                if (ignoreRunningPrebuild) {
                    // in force mode we ignore running prebuilds as we want to start a workspace as quickly as we can.
                    return;
                }

                const workspaceID = prebuiltWorkspace.buildWorkspaceId;
                const makeResult = (instanceID: string): WorkspaceCreationResult => {
                    return <WorkspaceCreationResult>{
                        runningWorkspacePrebuild: {
                            prebuildID: prebuiltWorkspace!.id,
                            workspaceID,
                            instanceID,
                            starting: "queued",
                            sameCluster: false,
                        },
                    };
                };

                const wsi = await this.workspaceDb.trace(ctx).findCurrentInstance(workspaceID);
                if (!wsi || wsi.stoppedTime !== undefined) {
                    if (prebuiltWorkspace.state === "queued") {
                        if (Date.now() - Date.parse(prebuiltWorkspace.creationTime) > 1000 * 60) {
                            // queued for long than a minute? Let's retrigger
                            console.warn("Retriggering queued prebuild.", prebuiltWorkspace);
                            try {
                                await this.prebuildManager.retriggerPrebuild(ctx, user, workspaceID);
                            } catch (err) {
                                console.error(err);
                            }
                        }
                        return makeResult(wsi!.id);
                    }

                    return;
                }

                // (AT) At this point we found a running/building prebuild, which might also include
                // image build in current state.
                //
                // The owner's client connection is automatically registered to listen on instance updates.
                // For the remaining client connections which would handle `createWorkspace` and end up here, it
                // also would be reasonable to listen on the instance updates of a running prebuild, or image build.
                //
                // We need to be forwarded the WorkspaceInstanceUpdates in the frontend, because we do not have
                // any other means to reliably learn about the status about image builds, yet.
                // Once we have those, we should remove this.
                //
                const ws = await this.workspaceDb.trace(ctx).findById(workspaceID);
                if (!!ws && !!wsi && ws.ownerId !== this.user?.id) {
                    const resetListener = this.localMessageBroker.listenForWorkspaceInstanceUpdates(
                        ws.ownerId,
                        (ctx, instance) => {
                            if (instance.id === wsi.id) {
                                this.forwardInstanceUpdateToClient(ctx, instance);
                                if (instance.status.phase === "stopped") {
                                    resetListener.dispose();
                                }
                            }
                        },
                    );
                    this.disposables.push(resetListener);
                }

                const result = makeResult(wsi.id);

                const inSameCluster = wsi.region === this.config.installationShortname;
                if (!inSameCluster) {
                    /* We need to wait for this prebuild to finish before we return from here.
                     * This creation mode is meant to be used once we have gone through default mode, have confirmation from the
                     * message bus that the prebuild is done, and now only have to wait for dbsync to come through. Thus,
                     * in this mode we'll poll the database until the prebuild is ready (or we time out).
                     *
                     * Note: This polling mechanism only makes sense if the prebuild runs in cluster different from ours.
                     *       Otherwise there's no dbsync inbetween that we might have to wait for.
                     *
                     * DB sync interval is 2 seconds at the moment, we wait ten "ticks" for the data to be synchronized.
                     */
                    const finishedPrebuiltWorkspace = await this.pollDatabaseUntilPrebuildIsAvailable(
                        ctx,
                        prebuiltWorkspace.id,
                        20000,
                    );
                    if (!finishedPrebuiltWorkspace) {
                        log.warn(
                            logCtx,
                            "did not find a finished prebuild in the database despite waiting long enough after msgbus confirmed that the prebuild had finished",
                            logPayload,
                        );
                        return;
                    } else {
                        return {
                            title: context.title,
                            originalContext: context,
                            prebuiltWorkspace: finishedPrebuiltWorkspace,
                        } as PrebuiltWorkspaceContext;
                    }
                }

                /* This is the default mode behaviour: we present the running prebuild to the user so that they can see the logs
                 * or choose to force the creation of a workspace.
                 */
                if (wsi.status.phase != "running") {
                    result.runningWorkspacePrebuild!.starting = "starting";
                } else {
                    result.runningWorkspacePrebuild!.starting = "running";
                }
                log.info(
                    logCtx,
                    `Found prebuilding (starting=${
                        result.runningWorkspacePrebuild!.starting
                    }) workspace for ${cloneUrl}:${commitSHAs}`,
                    logPayload,
                );
                return result;
            }
        } catch (e) {
            TraceContext.setError(ctx, e);
            throw e;
        } finally {
            ctx.span.finish();
        }
    }

    async adminSetLicense(ctx: TraceContext, key: string): Promise<void> {
        traceAPIParams(ctx, {}); // don't trace the actual key

        await this.guardAdminAccess("adminGetWorkspaces", { key }, Permission.ADMIN_API);

        await this.licenseDB.store(uuidv4(), key);
        await this.licenseEvaluator.reloadLicense();
    }

    async licenseIncludesFeature(ctx: TraceContext, licenseFeature: LicenseFeature): Promise<boolean> {
        traceAPIParams(ctx, { licenseFeature });

        this.checkAndBlockUser("licenseIncludesFeature");

        let feature: Feature | undefined;
        switch (licenseFeature) {
            case LicenseFeature.CreateSnapshot:
                feature = Feature.FeatureSnapshot;
            // room for more
            default:
        }
        if (feature) {
            const userCount = await this.userDB.getUserCount(true);
            return this.licenseEvaluator.isEnabled(feature, userCount);
        }
        return false;
    }

    // (SaaS) – accounting
    public async getAccountStatement(
        ctx: TraceContext,
        options: GitpodServer.GetAccountStatementOptions,
    ): Promise<AccountStatement> {
        traceAPIParams(ctx, { options });

        const user = this.checkUser("getAccountStatement");
        const now = options.date || new Date().toISOString();
        return this.accountStatementProvider.getAccountStatement(user.id, now);
    }

    public async getRemainingUsageHours(ctx: TraceContext): Promise<number> {
        const user = this.checkUser("getRemainingUsageHours");
        const runningInstancesPromise = this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
        return this.accountStatementProvider.getRemainingUsageHours(
            user.id,
            new Date().toISOString(),
            runningInstancesPromise,
        );
    }

    // (SaaS) – payment/billing
    async getAvailableCoupons(ctx: TraceContext): Promise<PlanCoupon[]> {
        const user = this.checkUser("getAvailableCoupons");
        const couponIds = await this.couponComputer.getAvailableCouponIds(user);
        return this.getChargebeePlanCoupons(ctx, couponIds);
    }

    async getAppliedCoupons(ctx: TraceContext): Promise<PlanCoupon[]> {
        const user = this.checkUser("getAppliedCoupons");
        const couponIds = await this.couponComputer.getAppliedCouponIds(user, new Date());
        return this.getChargebeePlanCoupons(ctx, couponIds);
    }

    // chargebee
    async getChargebeeSiteId(ctx: TraceContext): Promise<string> {
        this.checkUser("getChargebeeSiteId");
        if (!this.config.chargebeeProviderOptions) {
            log.error("config error: expected chargebeeProviderOptions but found none!");
            return "none";
        }
        return this.config.chargebeeProviderOptions.site;
    }

    public async isStudent(ctx: TraceContext): Promise<boolean> {
        const user = this.checkUser("isStudent");
        return this.eligibilityService.isStudent(user);
    }

    // TODO(gpl) Should we deprecate this entirely to more clearly distinguish between "license" and "paid"?
    async getShowPaymentUI(ctx: TraceContext): Promise<boolean> {
        this.checkUser("getShowPaymentUI");
        return !!this.config.enablePayment;
    }

    async isChargebeeCustomer(ctx: TraceContext): Promise<boolean> {
        const user = this.checkUser("isChargebeeCustomer");

        return await new Promise<boolean>((resolve, reject) => {
            this.chargebeeProvider.customer.retrieve(user.id).request((error, result) => {
                if (error) {
                    // the error is of no use to the client - they can't do anything about it.
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    protected async getChargebeePlanCoupons(ctx: TraceContext, couponIds: string[]) {
        traceAPIParams(ctx, { couponIds });

        const chargebeeCoupons = await Promise.all(
            couponIds.map(
                (c) =>
                    new Promise<chargebee.Coupon | undefined>((resolve, reject) =>
                        this.chargebeeProvider.coupon.retrieve(c).request((err, res) => {
                            if (!!err) {
                                log.error({}, "could not retrieve coupon: " + err.message, { coupon: c });
                                resolve(undefined);
                            } else if (!!res) {
                                resolve(res.coupon);
                            } else {
                                resolve(undefined);
                            }
                        }),
                    ),
            ),
        );

        const result: PlanCoupon[] = [];
        for (const coupon of chargebeeCoupons) {
            if (!coupon) {
                continue;
            }
            if (!coupon.plan_ids) {
                // This coupon does not apply to any plan - we can't use it here
                continue;
            }
            if (!coupon.discount_percentage) {
                // For the time being we only support percentage discount coupons here.
                // This may change once we need something else.
                continue;
            }

            for (const planID of coupon.plan_ids) {
                const plan = Plans.getById(planID);
                if (!plan) {
                    continue;
                }

                let newPrice = (plan.pricePerMonth * 100) / (100 - coupon.discount_percentage);
                result.push({
                    description: coupon.name,
                    newPrice,
                    chargebeePlanID: planID,
                });
            }
        }

        return result;
    }

    async createPortalSession(ctx: TraceContext): Promise<{}> {
        const user = this.checkUser("createPortalSession");
        const logContext = { userId: user.id };

        return await new Promise((resolve, reject) => {
            this.chargebeeProvider.portal_session
                .create({
                    customer: {
                        id: user.id,
                    },
                })
                .request(function (error: any, result: any) {
                    if (error) {
                        log.error(logContext, "User portal session creation error", error);
                        reject(error);
                    } else {
                        log.debug(logContext, "User portal session created");
                        resolve(result.portal_session);
                    }
                });
        });
    }

    async createTeamPortalSession(ctx: TraceContext, teamId: string): Promise<{}> {
        traceAPIParams(ctx, { teamId });

        this.checkUser("createTeamPortalSession");

        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
        }
        const members = await this.teamDB.findMembersByTeam(team.id);
        await this.guardAccess({ kind: "team", subject: team, members }, "update");

        return await new Promise((resolve, reject) => {
            this.chargebeeProvider.portal_session
                .create({
                    customer: {
                        id: "team:" + team.id,
                    },
                })
                .request(function (error: any, result: any) {
                    if (error) {
                        log.error("Team portal session creation error", error);
                        reject(error);
                    } else {
                        log.debug("Team portal session created");
                        resolve(result.portal_session);
                    }
                });
        });
    }

    async checkout(ctx: TraceContext, planId: string, planQuantity?: number): Promise<{}> {
        traceAPIParams(ctx, { planId, planQuantity });

        const user = this.checkUser("checkout");
        const logContext = { userId: user.id };
        await this.ensureChargebeeApiIsAllowed({ user });

        // Throws an error if not the case
        await this.ensureIsEligibleForPlan(user, planId);

        const coupon = await this.findAvailableCouponForPlan(user, planId);

        try {
            const email = User.getPrimaryEmail(user);
            if (!email) {
                throw new Error("No identity with primary email for user");
            }

            return new Promise((resolve, reject) => {
                this.chargebeeProvider.hosted_page
                    .checkout_new({
                        customer: {
                            id: user.id,
                            email,
                        },
                        subscription: {
                            plan_id: planId,
                            plan_quantity: planQuantity,
                            coupon,
                        },
                    })
                    .request((error: any, result: any) => {
                        if (error) {
                            log.error(logContext, "Checkout page error", error);
                            reject(error);
                        } else {
                            log.debug(logContext, "Checkout page initiated");
                            resolve(result.hosted_page);
                        }
                    });
            });
        } catch (err) {
            log.error(logContext, "Checkout error", err);
            throw err;
        }
    }

    async teamCheckout(ctx: TraceContext, teamId: string, planId: string): Promise<{}> {
        traceAPIParams(ctx, { teamId, planId });

        const user = this.checkUser("teamCheckout");

        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
        }
        await this.ensureChargebeeApiIsAllowed({ team });
        const members = await this.teamDB.findMembersByTeam(team.id);
        await this.guardAccess({ kind: "team", subject: team, members }, "update");

        const coupon = await this.findAvailableCouponForPlan(user, planId);

        const email = User.getPrimaryEmail(user);
        return new Promise((resolve, reject) => {
            this.chargebeeProvider.hosted_page
                .checkout_new({
                    customer: {
                        id: "team:" + team.id,
                        email,
                    },
                    subscription: {
                        plan_id: planId,
                        plan_quantity: members.length,
                        coupon,
                    },
                })
                .request((error: any, result: any) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(result.hosted_page);
                });
        });
    }

    protected async findAvailableCouponForPlan(user: User, planId: string): Promise<string | undefined> {
        const couponNames = await this.couponComputer.getAvailableCouponIds(user);
        const chargbeeCoupons = await Promise.all(
            couponNames.map(
                (c) =>
                    new Promise<chargebee.Coupon | undefined>((resolve, reject) =>
                        this.chargebeeProvider.coupon.retrieve(c).request((err, res) => {
                            if (!!err) {
                                log.error({}, "could not retrieve coupon: " + err.message, { coupon: c });
                                resolve(undefined);
                            } else if (!!res) {
                                resolve(res.coupon);
                            } else {
                                resolve(undefined);
                            }
                        }),
                    ),
            ),
        );
        const applicableCoupon = chargbeeCoupons
            .filter((c) => c && c.discount_percentage && c.plan_ids && c.plan_ids.indexOf(planId) != -1)
            .sort((a, b) => (a!.discount_percentage! < b!.discount_percentage! ? -1 : 1))[0];
        return applicableCoupon ? applicableCoupon.id : undefined;
    }

    async subscriptionUpgradeTo(ctx: TraceContext, subscriptionId: string, chargebeePlanId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId, chargebeePlanId });

        const user = this.checkUser("subscriptionUpgradeTo");
        await this.ensureChargebeeApiIsAllowed({ user });
        await this.ensureIsEligibleForPlan(user, chargebeePlanId);
        await this.doUpdateUserPaidSubscription(user.id, subscriptionId, chargebeePlanId, false);
    }

    async subscriptionDowngradeTo(ctx: TraceContext, subscriptionId: string, chargebeePlanId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId, chargebeePlanId });

        const user = this.checkUser("subscriptionDowngradeTo");
        await this.ensureChargebeeApiIsAllowed({ user });
        await this.ensureIsEligibleForPlan(user, chargebeePlanId);
        await this.doUpdateUserPaidSubscription(user.id, subscriptionId, chargebeePlanId, true);
    }

    protected async ensureIsEligibleForPlan(user: User, chargebeePlanId: string): Promise<void> {
        const p = Plans.getById(chargebeePlanId);
        if (!p) {
            log.error({ userId: user.id }, "Invalid plan", { planId: chargebeePlanId });
            throw new Error(`Invalid plan: ${chargebeePlanId}`);
        }

        if (p.type === "student") {
            const isStudent = await this.eligibilityService.isStudent(user);
            if (!isStudent) {
                throw new ResponseError(
                    ErrorCodes.PLAN_ONLY_ALLOWED_FOR_STUDENTS,
                    "This plan is only allowed for students",
                );
            }
        }
    }

    async subscriptionCancel(ctx: TraceContext, subscriptionId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId });

        const user = this.checkUser("subscriptionCancel");
        const chargebeeSubscriptionId = await this.doGetUserPaidSubscription(user.id, subscriptionId);
        await this.chargebeeService.cancelSubscription(
            chargebeeSubscriptionId,
            { userId: user.id },
            { subscriptionId, chargebeeSubscriptionId },
        );
    }

    async subscriptionCancelDowngrade(ctx: TraceContext, subscriptionId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId });

        const user = this.checkUser("subscriptionCancelDowngrade");
        await this.ensureChargebeeApiIsAllowed({ user });
        await this.doCancelDowngradeUserPaidSubscription(user.id, subscriptionId);
    }

    protected async doUpdateUserPaidSubscription(
        userId: string,
        subscriptionId: string,
        newPlanId: string,
        applyEndOfTerm: boolean,
    ) {
        const chargebeeSubscriptionId = await this.doGetUserPaidSubscription(userId, subscriptionId);
        return this.doUpdateSubscription(userId, chargebeeSubscriptionId, {
            plan_id: newPlanId,
            end_of_term: applyEndOfTerm,
        });
    }

    protected async doUpdateSubscription(
        userId: string,
        chargebeeSubscriptionId: string,
        update: Partial<chargebee.SubscriptionUpdateParams> = {},
    ) {
        const logContext = { userId };
        const logPayload = { chargebeeSubscriptionId, update };
        return await new Promise<void>((resolve, reject) => {
            this.chargebeeProvider.subscription
                .update(chargebeeSubscriptionId, {
                    ...update,
                })
                .request((error: any, result: any) => {
                    if (error) {
                        log.error(logContext, "Chargebee Subscription update error", error, logPayload);
                        reject(error);
                    } else {
                        log.debug(logContext, "Chargebee Subscription updated", logPayload);
                        resolve();
                    }
                });
        });
    }

    protected async doCancelDowngradeUserPaidSubscription(userId: string, subscriptionId: string) {
        const chargebeeSubscriptionId = await this.doGetUserPaidSubscription(userId, subscriptionId);
        const logContext = { userId };
        const logPayload = { subscriptionId, chargebeeSubscriptionId };
        return await new Promise<void>((resolve, reject) => {
            this.chargebeeProvider.subscription
                .remove_scheduled_changes(chargebeeSubscriptionId)
                .request((error: any, result: any) => {
                    if (error) {
                        log.error(
                            logContext,
                            "Chargebee remove scheduled change to Subscription error",
                            error,
                            logPayload,
                        );
                        reject(error);
                    } else {
                        log.debug(logContext, "Chargebee scheduled change to Subscription removed", logPayload);
                        resolve();
                    }
                });
        });
    }

    protected async doGetUserPaidSubscription(userId: string, subscriptionId: string) {
        const subscription = await this.internalGetSubscription(subscriptionId, userId);
        const chargebeeSubscriptionId = subscription.paymentReference;
        if (!chargebeeSubscriptionId) {
            const err = new Error(`SubscriptionId ${subscriptionId} has no paymentReference!`);
            log.error({ userId: userId }, err, { subscriptionId });
            throw err;
        }
        return chargebeeSubscriptionId;
    }

    // Team Subscriptions 2
    async getTeamSubscription(ctx: TraceContext, teamId: string): Promise<TeamSubscription2 | undefined> {
        this.checkUser("getTeamSubscription");
        await this.guardTeamOperation(teamId, "get");
        return this.teamSubscription2DB.findForTeam(teamId, new Date().toISOString());
    }

    protected async onTeamMemberAdded(userId: string, teamId: string): Promise<void> {
        const now = new Date();
        const ts2 = await this.teamSubscription2DB.findForTeam(teamId, now.toISOString());
        if (ts2) {
            await this.updateTeamSubscriptionQuantity(ts2);
            await this.teamSubscription2Service.addTeamMemberSubscription(ts2, userId);
        }
    }

    protected async onTeamMemberRemoved(userId: string, teamId: string, teamMembershipId: string): Promise<void> {
        const now = new Date();
        const ts2 = await this.teamSubscription2DB.findForTeam(teamId, now.toISOString());
        if (ts2) {
            await this.updateTeamSubscriptionQuantity(ts2);
            await this.teamSubscription2Service.cancelTeamMemberSubscription(ts2, userId, teamMembershipId, now);
        }
    }

    protected async onTeamDeleted(teamId: string): Promise<void> {
        const now = new Date();
        const ts2 = await this.teamSubscription2DB.findForTeam(teamId, now.toISOString());
        if (ts2) {
            const chargebeeSubscriptionId = ts2.paymentReference;
            await this.chargebeeService.cancelSubscription(
                chargebeeSubscriptionId,
                {},
                { teamId, chargebeeSubscriptionId },
            );
        }
        if (this.config.enablePayment) {
            const subscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(
                AttributionId.render({ kind: "team", teamId: teamId }),
            );
            if (subscriptionId) {
                await this.stripeService.cancelSubscription(subscriptionId);
            }
        }
    }

    protected async updateTeamSubscriptionQuantity(teamSubscription: TeamSubscription2): Promise<void> {
        const members = await this.teamDB.findMembersByTeam(teamSubscription.teamId);
        const newQuantity = members.length;
        try {
            // We only charge for upgrades in the Chargebee callback, to avoid race conditions.
            await this.doUpdateSubscription("", teamSubscription.paymentReference, {
                plan_quantity: newQuantity,
                end_of_term: false,
            });
        } catch (err) {
            if (chargebee.ApiError.is(err) && err.type === "payment") {
                throw new ResponseError(ErrorCodes.PAYMENT_ERROR, `${err.api_error_code}: ${err.message}`);
            }
        }
    }

    // Team Subscriptions (legacy)
    async tsGet(ctx: TraceContext): Promise<TeamSubscription[]> {
        const user = this.checkUser("tsGet");
        return this.teamSubscriptionDB.findTeamSubscriptionsForUser(user.id, new Date().toISOString());
    }

    async tsGetSlots(ctx: TraceContext): Promise<TeamSubscriptionSlotResolved[]> {
        const user = this.checkUser("tsGetSlots");
        return this.teamSubscriptionService.findTeamSubscriptionSlotsBy(user.id, new Date());
    }

    async tsGetUnassignedSlot(
        ctx: TraceContext,
        teamSubscriptionId: string,
    ): Promise<TeamSubscriptionSlot | undefined> {
        traceAPIParams(ctx, { teamSubscriptionId });

        this.checkUser("tsGetUnassignedSlot");
        const slots = await this.teamSubscriptionService.findUnassignedSlots(teamSubscriptionId);
        return slots[0];
    }

    // Get the current number of "active" slots in a team subscription (count all "assigned" and "unassigned", but not "deactivated" or "cancelled").
    protected async tsGetActiveSlotQuantity(teamSubscriptionId: string): Promise<number> {
        const slots = await this.teamSubscriptionDB.findSlotsByTeamSubscriptionId(teamSubscriptionId);
        return slots.filter(TeamSubscriptionSlot.isActive).length;
    }

    async tsAddSlots(ctx: TraceContext, teamSubscriptionId: string, addQuantity: number): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, addQuantity });

        const user = this.checkAndBlockUser("tsAddSlots");
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, user.id);

        if (addQuantity <= 0) {
            const err = new Error(`Invalid quantity!`);
            log.error({ userId: user.id }, err, { teamSubscriptionId, addQuantity });
            throw err;
        }

        const oldQuantity = await this.tsGetActiveSlotQuantity(teamSubscriptionId);
        const newQuantity = oldQuantity + addQuantity;
        try {
            const now = new Date();
            await this.doUpdateTeamSubscription(user.id, ts.id, newQuantity, false);
            await this.doChargeForTeamSubscriptionUpgrade(ts, oldQuantity, newQuantity, now.toISOString());
            await this.teamSubscriptionService.addSlots(ts, addQuantity);
        } catch (err) {
            if (chargebee.ApiError.is(err) && err.type === "payment") {
                throw new ResponseError(ErrorCodes.PAYMENT_ERROR, `${err.api_error_code}: ${err.message}`);
            }
            log.error({ userId: user.id }, "tsAddSlots", err);
        }
    }

    async tsAssignSlot(
        ctx: TraceContext,
        teamSubscriptionId: string,
        teamSubscriptionSlotId: string,
        identityStr: string | undefined,
    ): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId }); // identityStr contains PII

        const user = this.checkAndBlockUser("tsAssignSlot");
        // assigning a slot can be done by third users
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, identityStr ? user.id : undefined);
        const logCtx = { userId: user.id };

        try {
            // Verify assignee:
            //  - must be existing Gitpod user, uniquely identifiable per GitHub/GitLab/Bitbucket name
            //  - in case of Student Subscription: Must be a student
            const assigneeInfo: FindUserByIdentityStrResult = identityStr
                ? await this.findAssignee(logCtx, identityStr)
                : await this.getAssigneeInfo(ctx, user);
            const { user: assignee, identity: assigneeIdentity, authHost } = assigneeInfo;
            // check here that current user is either the assignee or assigner.
            await this.ensureMayGetAssignedToTS(ts, user, assignee);

            const assigneeIdentifier: AssigneeIdentityIdentifier = {
                identity: { authHost, authName: assigneeIdentity.authName },
            };
            await this.teamSubscriptionService.assignSlot(
                ts,
                teamSubscriptionSlotId,
                assignee,
                assigneeIdentifier,
                new Date(),
            );
        } catch (err) {
            log.debug(logCtx, "tsAssignSlot", err);
            throw err;
        }
    }

    // Find an (identity, authHost) tuple that uniquely identifies a user (to generate an `identityStr`).
    protected async getAssigneeInfo(ctx: TraceContext, user: User) {
        const authProviders = await this.getAuthProviders(ctx);
        for (const identity of user.identities) {
            const provider = authProviders.find((p) => p.authProviderId === identity.authProviderId);
            if (provider && provider.host) {
                return { user, identity, authHost: provider.host };
            }
        }
        throw new ResponseError(
            ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED,
            "Could not find a unique identifier for assignee.",
        );
    }

    protected async ensureMayGetAssignedToTS(ts: TeamSubscription, user: User, assignee: User) {
        if (user.id !== ts.userId && user.id !== assignee.id) {
            throw new ResponseError(
                ErrorCodes.PERMISSION_DENIED,
                "Only the owner or the assignee may assign a team subscription!",
            );
        }
        const slots = await this.teamSubscriptionDB.findSlotsByAssignee(assignee.id);
        const now = new Date().toISOString();
        const assignedSlots = slots.filter((slot) => TeamSubscriptionSlot.status(slot, now) === "assigned");
        if (assignedSlots.length > 0) {
            if (assignedSlots.some((slot) => slot.teamSubscriptionId === ts.id)) {
                throw new ResponseError(
                    ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED,
                    `The assignee already has a slot in this team subsciption.`,
                );
            } else {
                throw new ResponseError(
                    ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED,
                    `Can not assign a slot in the team subsciption because the assignee already has a slot in another team subscription.`,
                );
            }
        }
        await this.ensureIsEligibleForPlan(assignee, ts.planId);
    }

    async tsReassignSlot(
        ctx: TraceContext,
        teamSubscriptionId: string,
        teamSubscriptionSlotId: string,
        newIdentityStr: string,
    ): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId }); // newIdentityStr contains PII

        const user = this.checkAndBlockUser("tsReassignSlot");
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, user.id);
        const logCtx = { userId: user.id };
        const assigneeInfo = await this.findAssignee(logCtx, newIdentityStr);

        try {
            const now = new Date();
            const { user: assignee, identity: assigneeIdentity, authHost } = assigneeInfo;
            const assigneeIdentifier: AssigneeIdentityIdentifier = {
                identity: { authHost, authName: assigneeIdentity.authName },
            };
            await this.teamSubscriptionService.reassignSlot(
                ts,
                teamSubscriptionSlotId,
                assignee,
                assigneeIdentifier,
                now,
            );
        } catch (err) {
            log.error(logCtx, "tsReassignSlot", err);
        }
    }

    protected readonly findAssigneeThrottler = pThrottle({ limit: 1, interval: 1000 });
    protected readonly findAssigneeThrottled: pThrottle.ThrottledFunction<any[], FindUserByIdentityStrResult> =
        this.findAssigneeThrottler(
            async (logCtx: LogContext, identityStr: string): Promise<FindUserByIdentityStrResult> => {
                let assigneeInfo = undefined;
                try {
                    assigneeInfo = await this.userService.findUserByIdentityStr(identityStr);
                } catch (err) {
                    log.error(logCtx, err);
                }
                if (!assigneeInfo) {
                    throw new ResponseError(ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED, `Gitpod user not found`, {
                        msg: `Gitpod user not found`,
                    });
                }
                return assigneeInfo;
            },
        );

    protected async findAssignee(logCtx: LogContext, identityStr: string) {
        return await this.findAssigneeThrottled(logCtx, identityStr);
    }

    protected updateTeamSubscriptionQueue = new Queue();

    async tsDeactivateSlot(
        ctx: TraceContext,
        teamSubscriptionId: string,
        teamSubscriptionSlotId: string,
    ): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId });

        const user = this.checkAndBlockUser("tsDeactivateSlot");
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, user.id);

        this.updateTeamSubscriptionQueue
            .enqueue(async () => {
                // Check number of currently active slots
                const newQuantity = (await this.tsGetActiveSlotQuantity(teamSubscriptionId)) - 1;
                try {
                    const now = new Date();
                    // Downgrade by 1 unit
                    await this.doUpdateTeamSubscription(user.id, ts.id, newQuantity, false);
                    await this.teamSubscriptionService.deactivateSlot(ts, teamSubscriptionSlotId, now);
                } catch (err) {
                    log.error({ userId: user.id }, "tsDeactivateSlot", err);
                }
            })
            .catch((err) => {
                /** ignore */
            });
    }

    async tsReactivateSlot(
        ctx: TraceContext,
        teamSubscriptionId: string,
        teamSubscriptionSlotId: string,
    ): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId });

        const user = this.checkAndBlockUser("tsReactivateSlot");
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, user.id);

        this.updateTeamSubscriptionQueue
            .enqueue(async () => {
                // Check number of currently active slots
                const newQuantity = (await this.tsGetActiveSlotQuantity(teamSubscriptionId)) + 1;
                try {
                    const now = new Date();
                    // Upgrade by 1 unit (but don't charge again!)
                    await this.doUpdateTeamSubscription(user.id, ts.id, newQuantity, false);
                    await this.teamSubscriptionService.reactivateSlot(ts, teamSubscriptionSlotId, now);
                } catch (err) {
                    log.error({ userId: user.id }, "tsReactivateSlot", err);
                }
            })
            .catch((err) => {
                /** ignore */
            });
    }

    async getGithubUpgradeUrls(ctx: TraceContext): Promise<GithubUpgradeURL[]> {
        const user = this.checkUser("getGithubUpgradeUrls");
        const ghidentity = user.identities.find((i) => i.authProviderId == "Public-GitHub");
        if (!ghidentity) {
            log.debug({ userId: user.id }, "user has no GitHub identity - cannot provide plan upgrade URLs");
            return [];
        }
        const produceUpgradeURL = (planID: number) =>
            `https://www.github.com/marketplace/${this.config.githubApp?.marketplaceName}/upgrade/${planID}/${ghidentity.authId}`;

        // GitHub plans are USD
        return Plans.getAvailablePlans("USD")
            .filter((p) => !!p.githubId && !!p.githubPlanNumber)
            .map((p) => <GithubUpgradeURL>{ url: produceUpgradeURL(p.githubPlanNumber!), planID: p.githubId! });
    }

    protected async doChargeForTeamSubscriptionUpgrade(
        ts: TeamSubscription,
        oldQuantity: number,
        newQuantity: number,
        upgradeTimestamp: string,
    ) {
        const chargebeeSubscriptionId = ts.paymentReference!; // Was checked before

        if (oldQuantity < newQuantity) {
            // Upgrade: Charge for it!
            const pricePerUnitInCents = await this.getPricePerUnitInCents(ts, chargebeeSubscriptionId);
            const diffInCents = pricePerUnitInCents * (newQuantity - oldQuantity);
            const description = `Difference on Upgrade from '${oldQuantity}' to '${newQuantity}' units (${formatDate(
                upgradeTimestamp,
            )})`;
            await this.upgradeHelper.chargeForUpgrade(
                ts.userId,
                chargebeeSubscriptionId,
                diffInCents,
                description,
                upgradeTimestamp,
            );
        }
    }

    protected async getPricePerUnitInCents(ts: TeamSubscription, chargebeeSubscriptionId: string): Promise<number> {
        const chargebeeSubscription = await this.getChargebeeSubscription(
            { userId: ts.userId },
            chargebeeSubscriptionId,
        );
        const subscriptionPlanUnitPriceInCents = chargebeeSubscription.plan_unit_price;
        if (subscriptionPlanUnitPriceInCents === undefined) {
            const plan = Plans.getById(ts.planId)!;
            return plan.pricePerMonth * 100;
        } else {
            return subscriptionPlanUnitPriceInCents;
        }
    }

    protected async getChargebeeSubscription(
        logCtx: LogContext,
        chargebeeSubscriptionId: string,
    ): Promise<chargebee.Subscription> {
        const logPayload = { chargebeeSubscriptionId: chargebeeSubscriptionId };
        const retrieveResult = await new Promise<chargebee.SubscriptionRetrieveResult>((resolve, reject) => {
            this.chargebeeProvider.subscription
                .retrieve(chargebeeSubscriptionId)
                .request(function (error: any, result: any) {
                    if (error) {
                        log.error(logCtx, "Retrieve subscription: error", error, logPayload);
                        reject(error);
                    } else {
                        log.debug(logCtx, "Retrieve subscription: successful", logPayload);
                        resolve(result);
                    }
                });
        });
        return retrieveResult.subscription;
    }

    protected async doUpdateTeamSubscription(
        userId: string,
        teamSubscriptionId: string,
        newQuantity: number,
        applyEndOfTerm: boolean,
    ) {
        const logContext = { userId };
        const teamSubscription = await this.internalGetTeamSubscription(teamSubscriptionId, userId);
        const chargebeeSubscriptionId = teamSubscription.paymentReference;
        if (!chargebeeSubscriptionId) {
            const err = new Error(`TeamSubscriptionId ${teamSubscriptionId} has no paymentReference!`);
            log.error(logContext, err, { teamSubscriptionId });
            throw err;
        }
        await this.doUpdateSubscription(userId, chargebeeSubscriptionId, {
            plan_quantity: newQuantity,
            end_of_term: applyEndOfTerm,
        });
    }

    /**
     * Checks access permissions and throws ResponseError on failure
     * @param id
     * @param userId
     */
    protected async internalGetTeamSubscription(id: string, userId?: string): Promise<TeamSubscription> {
        const teamSubscription = await this.teamSubscriptionDB.findTeamSubscriptionById(id);
        if (!teamSubscription) {
            const msg = `No team subscription with id '${id}' found.`;
            log.error({ userId }, msg);
            throw new Error(msg);
        }
        if (userId && userId !== teamSubscription.userId) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Only the owner may access a team subscription!");
        }
        return teamSubscription;
    }

    protected async internalGetSubscription(id: string, userId: string): Promise<Subscription> {
        const subscription = await this.accountingDB.findSubscriptionById(id);
        if (!subscription) {
            const msg = `No subscription with id '${id}' found.`;
            log.error({ userId }, msg);
            throw new Error(msg);
        }
        if (userId !== subscription.userId) {
            const err = new ResponseError(ErrorCodes.PERMISSION_DENIED, "Only the owner may access a subscription!");
            log.error({ userId }, err);
            throw err;
        }
        return subscription;
    }

    protected async ensureChargebeeApiIsAllowed(sub: { user?: User; team?: Team }): Promise<void> {
        await this.ensureBillingMode(sub, (m) => m.mode === "chargebee");
    }

    protected async ensureStripeApiIsAllowed(sub: { user?: User; team?: Team }): Promise<void> {
        await this.ensureBillingMode(
            sub,
            // Stripe is allowed when you either are on the usage-based side already, or you can switch to)
            (m) => m.mode === "usage-based" || (m.mode === "chargebee" && !!m.canUpgradeToUBB),
        );
    }

    protected async ensureBillingMode(
        subject: { user?: User; team?: Team },
        predicate: (m: BillingMode) => boolean,
    ): Promise<void> {
        let billingMode: BillingMode | undefined = undefined;
        if (subject.user) {
            billingMode = await this.billingModes.getBillingModeForUser(subject.user, new Date());
        } else if (subject.team) {
            billingMode = await this.billingModes.getBillingModeForTeam(subject.team, new Date());
        }

        if (billingMode && predicate(billingMode)) {
            return;
        }
        throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
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
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        this.checkAndBlockUser("findStripeSubscriptionId");

        try {
            if (attrId.kind == "team") {
                await this.guardTeamOperation(attrId.teamId, "get");
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

    async createStripeCustomerIfNeeded(ctx: TraceContext, attributionId: string, currency: string): Promise<void> {
        const user = this.checkAndBlockUser("createStripeCustomerIfNeeded");
        const attrId = AttributionId.parse(attributionId);
        if (!attrId) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attributionId '${attributionId}'`);
        }
        let team: Team | undefined;
        if (attrId.kind === "team") {
            team = await this.guardTeamOperation(attrId.teamId, "update");
            await this.ensureStripeApiIsAllowed({ team });
        } else {
            if (attrId.userId !== user.id) {
                throw new ResponseError(
                    ErrorCodes.PERMISSION_DENIED,
                    "Cannot create Stripe customer profile for another user",
                );
            }
            await this.ensureStripeApiIsAllowed({ user });
        }

        const billingEmail = User.getPrimaryEmail(user);
        const billingName = attrId.kind === "team" ? team!.name : User.getName(user);
        try {
            try {
                // customer already exists, we don't need to create a new one.
                await this.billingService.getStripeCustomer({ attributionId });
                return;
            } catch (e) {}

            await this.billingService.createStripeCustomer({
                attributionId,
                currency,
                email: billingEmail,
                name: billingName,
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

    async subscribeToStripe(
        ctx: TraceContext,
        attributionId: string,
        setupIntentId: string,
        usageLimit: number,
    ): Promise<number | undefined> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const user = this.checkAndBlockUser("subscribeToStripe");

        let team: Team | undefined;
        try {
            if (attrId.kind === "team") {
                team = await this.guardTeamOperation(attrId.teamId, "update");
                await this.ensureStripeApiIsAllowed({ team });
            } else {
                await this.ensureStripeApiIsAllowed({ user });
            }
            const customerId = await this.stripeService.findCustomerByAttributionId(attributionId);
            if (!customerId) {
                throw new Error(`No Stripe customer profile for '${attributionId}'`);
            }

            const createStripeSubscriptionOnUsage = await getExperimentsClientForBackend().getValueAsync(
                "createStripeSubscriptionOnUsage",
                false,
                {
                    user: user,
                    teamId: team ? team.id : undefined,
                },
            );

            if (createStripeSubscriptionOnUsage) {
                await this.billingService.createStripeSubscription({ attributionId, setupIntentId, usageLimit });
            } else {
                await this.stripeService.setDefaultPaymentMethodForCustomer(customerId, setupIntentId);
                await this.stripeService.createSubscriptionForCustomer(customerId, attributionId);
            }

            // Creating a cost center for this customer
            const { costCenter } = await this.usageService.setCostCenter({
                costCenter: {
                    attributionId: attributionId,
                    spendingLimit: usageLimit,
                    billingStrategy: CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE,
                },
            });

            this.messageBus.notifyOnSubscriptionUpdate(ctx, attrId).catch();

            return costCenter?.spendingLimit;
        } catch (error) {
            log.error(`Failed to subscribe '${attributionId}' to Stripe`, error);
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to subscribe '${attributionId}' to Stripe`,
            );
        }
    }

    async getStripePortalUrl(ctx: TraceContext, attributionId: string): Promise<string> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const user = this.checkAndBlockUser("getStripePortalUrl");

        let returnUrl = this.config.hostUrl.with(() => ({ pathname: `/billing` })).toString();
        if (attrId.kind === "user") {
            await this.ensureStripeApiIsAllowed({ user });
        } else if (attrId.kind === "team") {
            const team = await this.guardTeamOperation(attrId.teamId, "update");
            await this.ensureStripeApiIsAllowed({ team });
            returnUrl = this.config.hostUrl.with(() => ({ pathname: `/t/${team.slug}/billing` })).toString();
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

    async getUsageLimit(ctx: TraceContext, attributionId: string): Promise<number | undefined> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ResponseError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const user = this.checkAndBlockUser("getUsageLimit");
        await this.guardCostCenterAccess(ctx, user.id, attrId, "get");

        const costCenter = await this.usageService.getCostCenter({ attributionId });
        if (costCenter?.costCenter) {
            return costCenter.costCenter.spendingLimit;
        }
        return undefined;
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

        this.messageBus.notifyOnSubscriptionUpdate(ctx, attrId).catch();
    }

    async getNotifications(ctx: TraceContext): Promise<string[]> {
        const result = await super.getNotifications(ctx);
        const user = this.checkAndBlockUser("getNotifications");

        try {
            const billingMode = await this.billingModes.getBillingModeForUser(user, new Date());
            if (billingMode.mode === "usage-based") {
                const limit = await this.userService.checkUsageLimitReached(user);
                await this.guardCostCenterAccess(ctx, user.id, limit.attributionId, "get");

                switch (limit.attributionId.kind) {
                    case "user": {
                        if (limit.reached) {
                            result.unshift(`You have reached your usage limit.`);
                        } else if (limit.almostReached) {
                            result.unshift(`You have reached 80% or more of your usage limit.`);
                        }
                        break;
                    }
                    case "team": {
                        const teamOrUser = await this.teamDB.findTeamById(limit.attributionId.teamId);
                        if (teamOrUser) {
                            if (limit.reached) {
                                result.push(teamOrUser?.slug);
                                result.unshift(`Your team '${teamOrUser?.name}' has reached its usage limit.`);
                            } else if (limit.almostReached) {
                                result.push(teamOrUser?.slug);
                                result.unshift(
                                    `Your team '${teamOrUser?.name}' has reached 80% or more of its usage limit.`,
                                );
                            }
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            log.warn({ userId: user.id }, "Could not get usage-based notifications for user", { error });
        }

        return result;
    }

    async listUsage(ctx: TraceContext, req: ListUsageRequest): Promise<ListUsageResponse> {
        const { from, to } = req;
        const attributionId = AttributionId.parse(req.attributionId);
        if (!attributionId) {
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "Bad attribution ID", {
                attributionId: req.attributionId,
            });
        }
        traceAPIParams(ctx, { attributionId });
        const user = this.checkAndBlockUser("listUsage");
        await this.guardCostCenterAccess(ctx, user.id, attributionId, "get");

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
        const team = await this.guardTeamOperation(teamId, "get");

        return this.billingModes.getBillingModeForTeam(team, new Date());
    }

    // (SaaS) – admin
    async adminGetAccountStatement(ctx: TraceContext, userId: string): Promise<AccountStatement> {
        traceAPIParams(ctx, { userId });

        const user = this.checkAndBlockUser("adminGetAccountStatement");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        return await this.accountService.getAccountStatement(userId, new Date().toISOString());
    }

    async adminSetProfessionalOpenSource(ctx: TraceContext, userId: string, shouldGetProfOSS: boolean): Promise<void> {
        traceAPIParams(ctx, { userId, shouldGetProfOSS });

        const user = this.checkAndBlockUser("adminSetProfessionalOpenSource");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        if (shouldGetProfOSS) {
            await this.subscriptionService.subscribe(
                userId,
                Plans.FREE_OPEN_SOURCE,
                undefined,
                new Date().toISOString(),
            );
        } else {
            await this.subscriptionService.unsubscribe(
                userId,
                new Date().toISOString(),
                Plans.FREE_OPEN_SOURCE.chargebeeId,
            );
        }
    }

    async adminIsStudent(ctx: TraceContext, userId: string): Promise<boolean> {
        traceAPIParams(ctx, { userId });

        const user = this.checkAndBlockUser("adminIsStudent");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        return this.eligibilityService.isStudent(userId);
    }

    async adminAddStudentEmailDomain(ctx: TraceContext, userId: string, domain: string): Promise<void> {
        traceAPIParams(ctx, { userId, domain });

        const user = this.checkAndBlockUser("adminAddStudentEmailDomain");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        const domainEntry: EduEmailDomain = {
            domain: domain.toLowerCase(),
        };
        return this.eduDomainDb.storeDomainEntry(domainEntry);
    }

    async adminGrantExtraHours(ctx: TraceContext, userId: string, extraHours: number): Promise<void> {
        traceAPIParams(ctx, { userId, extraHours });

        const user = this.checkAndBlockUser("adminGrantExtraHours");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        await this.subscriptionService.addCredit(userId, extraHours, new Date().toISOString());
    }

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

    // Projects
    async getProviderRepositoriesForUser(
        ctx: TraceContext,
        params: { provider: string; hints?: object },
    ): Promise<ProviderRepository[]> {
        traceAPIParams(ctx, { params });

        const user = this.checkAndBlockUser("getProviderRepositoriesForUser");

        const repositories: ProviderRepository[] = [];
        const providerHost = params.provider;
        const provider = (await this.getAuthProviders(ctx)).find((ap) => ap.host === providerHost);

        if (providerHost === "github.com" && this.config.githubApp?.enabled) {
            repositories.push(...(await this.githubAppSupport.getProviderRepositoriesForUser({ user, ...params })));
        } else if (provider?.authProviderType === "GitHub") {
            const hostContext = this.hostContextProvider.get(providerHost);
            if (hostContext?.services) {
                repositories.push(
                    ...(await hostContext.services.repositoryService.getRepositoriesForAutomatedPrebuilds(user)),
                );
            }
        } else if (providerHost === "bitbucket.org" && provider) {
            repositories.push(...(await this.bitbucketAppSupport.getProviderRepositoriesForUser({ user, provider })));
        } else if (provider?.authProviderType === "BitbucketServer") {
            const hostContext = this.hostContextProvider.get(providerHost);
            if (hostContext?.services) {
                repositories.push(
                    ...(await hostContext.services.repositoryService.getRepositoriesForAutomatedPrebuilds(user)),
                );
            }
        } else if (provider?.authProviderType === "GitLab") {
            repositories.push(...(await this.gitLabAppSupport.getProviderRepositoriesForUser({ user, provider })));
        } else {
            log.info({ userId: user.id }, `Unsupported provider: "${params.provider}"`, { params });
        }
        const projects = await this.projectsService.getProjectsByCloneUrls(repositories.map((r) => r.cloneUrl));

        const cloneUrlToProject = new Map(projects.map((p) => [p.cloneUrl, p]));

        for (const repo of repositories) {
            const p = cloneUrlToProject.get(repo.cloneUrl);
            const repoProvider = new URL(repo.cloneUrl).host.split(".")[0];

            if (p) {
                if (p.userId) {
                    const owner = await this.userDB.findUserById(p.userId);
                    if (owner) {
                        const ownerProviderMatchingRepoProvider = owner.identities.find((identity, index) =>
                            identity.authProviderId.toLowerCase().includes(repoProvider),
                        );
                        if (ownerProviderMatchingRepoProvider) {
                            repo.inUse = {
                                userName: ownerProviderMatchingRepoProvider?.authName,
                            };
                        }
                    }
                } else if (p.teamOwners && p.teamOwners[0]) {
                    repo.inUse = {
                        userName: p.teamOwners[0] || "somebody",
                    };
                }
            }
        }

        return repositories;
    }

    public async getPrebuildEvents(ctx: TraceContext, projectId: string): Promise<PrebuildEvent[]> {
        traceAPIParams(ctx, { projectId });
        const user = this.checkAndBlockUser("getPrebuildEvents");

        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "get");

        const events = await this.projectsService.getPrebuildEvents(project.cloneUrl);
        return events;
    }

    async triggerPrebuild(
        ctx: TraceContext,
        projectId: string,
        branchName: string | null,
    ): Promise<StartPrebuildResult> {
        traceAPIParams(ctx, { projectId, branchName });

        const user = this.checkAndBlockUser("triggerPrebuild");

        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "update");

        const branchDetails = !!branchName
            ? await this.projectsService.getBranchDetails(user, project, branchName)
            : (await this.projectsService.getBranchDetails(user, project)).filter((b) => b.isDefault);
        if (branchDetails.length !== 1) {
            log.debug({ userId: user.id }, "Cannot find branch details.", { project, branchName });
            throw new ResponseError(
                ErrorCodes.NOT_FOUND,
                `Could not find ${!branchName ? "a default branch" : `branch '${branchName}'`} in repository ${
                    project.cloneUrl
                }`,
            );
        }
        const contextURL = branchDetails[0].url;

        const context = (await this.contextParser.handle(ctx, user, contextURL)) as CommitContext;

        // HACK: treat manual triggered prebuild as a reset for the inactivity state
        await this.projectDB.updateProjectUsage(project.id, {
            lastWorkspaceStart: new Date().toISOString(),
        });

        const prebuild = await this.prebuildManager.startPrebuild(ctx, {
            context,
            user,
            project,
            forcePrebuild: true,
        });

        this.analytics.track({
            userId: user.id,
            event: "prebuild_triggered",
            properties: {
                context_url: contextURL,
                clone_url: project.cloneUrl,
                commit: context.revision,
                branch: branchDetails[0].name,
                project_id: project.id,
            },
        });

        return prebuild;
    }

    async adminFindPrebuilds(ctx: TraceContext, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        traceAPIParams(ctx, { params });
        await this.requireEELicense(Feature.FeatureAdminDashboard);
        await this.guardAdminAccess("adminFindPrebuilds", { params }, Permission.ADMIN_PROJECTS);

        return this.projectsService.findPrebuilds(params);
    }

    async cancelPrebuild(ctx: TraceContext, projectId: string, prebuildId: string): Promise<void> {
        traceAPIParams(ctx, { projectId, prebuildId });

        const user = this.checkAndBlockUser("cancelPrebuild");

        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "update");

        const prebuild = await this.workspaceDb.trace(ctx).findPrebuildByID(prebuildId);
        if (!prebuild) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Prebuild not found");
        }
        // Explicitly stopping the prebuild workspace now automaticaly cancels the prebuild
        await this.stopWorkspace(ctx, prebuild.buildWorkspaceId);
    }

    public async createProject(ctx: TraceContext, params: CreateProjectParams): Promise<Project> {
        // parameters are already traced in super call
        const project = await super.createProject(ctx, params);

        // update client registration for the logged in user
        this.disposables.push(
            this.localMessageBroker.listenForPrebuildUpdates(
                project.id,
                (ctx: TraceContext, update: PrebuildWithStatus) =>
                    TraceContext.withSpan(
                        "forwardPrebuildUpdateToClient",
                        (ctx) => {
                            traceClientMetadata(ctx, this.clientMetadata);
                            TraceContext.setJsonRPCMetadata(ctx, "onPrebuildUpdate");

                            this.client?.onPrebuildUpdate(update);
                        },
                        ctx,
                    ),
            ),
        );
        return project;
    }
}

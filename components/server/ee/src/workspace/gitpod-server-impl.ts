/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { GitpodServerImpl, traceAPIParams, traceWI, censor } from "../../../src/workspace/gitpod-server-impl";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { GitpodServer, GitpodClient, AdminGetListRequest, User, AdminGetListResult, Permission, AdminBlockUserRequest, AdminModifyRoleOrPermissionRequest, RoleOrPermission, AdminModifyPermanentWorkspaceFeatureFlagRequest, UserFeatureSettings, AdminGetWorkspacesRequest, WorkspaceAndInstance, GetWorkspaceTimeoutResult, WorkspaceTimeoutDuration, WorkspaceTimeoutValues, SetWorkspaceTimeoutResult, WorkspaceContext, CreateWorkspaceMode, WorkspaceCreationResult, PrebuiltWorkspaceContext, CommitContext, PrebuiltWorkspace, PermissionName, WorkspaceInstance, EduEmailDomain, ProviderRepository, Queue, PrebuildWithStatus, CreateProjectParams, Project, StartPrebuildResult, ClientHeaderFields, Workspace } from "@gitpod/gitpod-protocol";
import { ResponseError } from "vscode-jsonrpc";
import { TakeSnapshotRequest, AdmissionLevel, ControlAdmissionRequest, StopWorkspacePolicy, DescribeWorkspaceRequest, SetTimeoutRequest } from "@gitpod/ws-manager/lib";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { v4 as uuidv4 } from 'uuid';
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { LicenseEvaluator, LicenseKeySource } from "@gitpod/licensor/lib";
import { Feature } from "@gitpod/licensor/lib/api";
import { LicenseValidationResult, LicenseFeature } from '@gitpod/gitpod-protocol/lib/license-protocol';
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { LicenseDB } from "@gitpod/gitpod-db/lib";
import { ResourceAccessGuard } from "../../../src/auth/resource-access";
import { AccountStatement, CreditAlert, Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { EligibilityService } from "../user/eligibility-service";
import { AccountStatementProvider } from "../user/account-statement-provider";
import { GithubUpgradeURL, PlanCoupon } from "@gitpod/gitpod-protocol/lib/payment-protocol";
import { AssigneeIdentityIdentifier, TeamSubscription, TeamSubscriptionSlot, TeamSubscriptionSlotResolved } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import pThrottle, { ThrottledFunction } from "p-throttle";
import { formatDate } from "@gitpod/gitpod-protocol/lib/util/date-time";
import { FindUserByIdentityStrResult } from "../../../src/user/user-service";
import { Accounting, AccountService, SubscriptionService, TeamSubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { AccountingDB, TeamSubscriptionDB, EduEmailDomainDB } from "@gitpod/gitpod-db/lib";
import { ChargebeeProvider, UpgradeHelper } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";
import { ChargebeeCouponComputer } from "../user/coupon-computer";
import { ChargebeeService } from "../user/chargebee-service";
import { Chargebee as chargebee } from '@gitpod/gitpod-payment-endpoint/lib/chargebee';

import { GitHubAppSupport } from "../github/github-app-support";
import { GitLabAppSupport } from "../gitlab/gitlab-app-support";
import { Config } from "../../../src/config";
import { SnapshotService, WaitForSnapshotOptions } from "./snapshot-service";
import { SafePromise } from "@gitpod/gitpod-protocol/lib/util/safe-promise";
import { ClientMetadata } from "../../../src/websocket/websocket-connection-manager";
import { BitbucketAppSupport } from "../bitbucket/bitbucket-app-support";
import { URL } from 'url';

@injectable()
export class GitpodServerEEImpl extends GitpodServerImpl {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(LicenseDB) protected readonly licenseDB: LicenseDB;
    @inject(LicenseKeySource) protected readonly licenseKeySource: LicenseKeySource;

    // per-user state
    @inject(EligibilityService) protected readonly eligibilityService: EligibilityService;
    @inject(AccountStatementProvider) protected readonly accountStatementProvider: AccountStatementProvider;

    @inject(AccountService) protected readonly accountService: AccountService;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(AccountingDB) protected readonly accountingDB: AccountingDB;
    @inject(EduEmailDomainDB) protected readonly eduDomainDb: EduEmailDomainDB;

    @inject(TeamSubscriptionDB) protected readonly teamSubscriptionDB: TeamSubscriptionDB;
    @inject(TeamSubscriptionService) protected readonly teamSubscriptionService: TeamSubscriptionService;

    @inject(ChargebeeProvider) protected readonly chargebeeProvider: ChargebeeProvider;
    @inject(UpgradeHelper) protected readonly upgradeHelper: UpgradeHelper;
    @inject(ChargebeeCouponComputer) protected readonly couponComputer: ChargebeeCouponComputer;
    @inject(ChargebeeService) protected readonly chargebeeService: ChargebeeService;

    @inject(GitHubAppSupport) protected readonly githubAppSupport: GitHubAppSupport;
    @inject(GitLabAppSupport) protected readonly gitLabAppSupport: GitLabAppSupport;
    @inject(BitbucketAppSupport) protected readonly bitbucketAppSupport: BitbucketAppSupport;

    @inject(Config) protected readonly config: Config;

    @inject(SnapshotService) protected readonly snapshotService: SnapshotService;

    initialize(client: GitpodClient | undefined, user: User | undefined, accessGuard: ResourceAccessGuard, clientMetadata: ClientMetadata, clientHeaderFields: ClientHeaderFields): void {
        super.initialize(client, user, accessGuard, clientMetadata, clientHeaderFields);

        this.listenToCreditAlerts();
        this.listenForPrebuildUpdates();
    }

    protected async listenForPrebuildUpdates() {
        // 'registering for prebuild updates for all projects this user has access to
        const projects = await this.getAccessibleProjects();
        for (const projectId of projects) {
            this.disposables.push(this.localMessageBroker.listenForPrebuildUpdates(
                projectId,
                (ctx: TraceContext, update: PrebuildWithStatus) => {
                    this.client?.onPrebuildUpdate(update);
                }
            ));
        }

        // TODO(at) we need to keep the list of accessible project up to date
    }

    protected async getAccessibleProjects() {
        if (!this.user) {
            return [];
        }

        // update all project this user has access to
        const allProjects: string[] = [];
        const teams = await this.teamDB.findTeamsByUser(this.user.id);
        for (const team of teams) {
            allProjects.push(...(await this.projectsService.getTeamProjects(team.id)).map(p => p.id));
        }
        allProjects.push(...(await this.projectsService.getUserProjects(this.user.id)).map(p => p.id));
        return allProjects;
    }

    /**
     * todo: the credit alert parts are migrated, but remain unused
     */
    protected listenToCreditAlerts(): void {
        if (!this.user || !this.client) {
            return;
        }
        this.disposables.push(this.localMessageBroker.listenToCreditAlerts(
            this.user.id,
            async (ctx: TraceContext, creditAlert: CreditAlert) => {
                this.client?.onCreditAlert(creditAlert);
                if (creditAlert.remainingUsageHours < 1e-6) {
                    const runningInstances = await this.workspaceDb.trace(ctx).findRegularRunningInstances(creditAlert.userId);
                    runningInstances.forEach(async instance => await this.stopWorkspace(ctx, instance.workspaceId));
                }
            }
        ));
    }

    protected async mayStartWorkspace(ctx: TraceContext, user: User, runningInstances: Promise<WorkspaceInstance[]>): Promise<void> {
        await super.mayStartWorkspace(ctx, user, runningInstances);

        const result = await this.eligibilityService.mayStartWorkspace(user, new Date(), runningInstances);
        if (!result.enoughCredits) {
            throw new ResponseError(ErrorCodes.NOT_ENOUGH_CREDIT, `Not enough credits. Please book more.`);
        }
        if (!!result.hitParallelWorkspaceLimit) {
            throw new ResponseError(ErrorCodes.TOO_MANY_RUNNING_WORKSPACES, `You cannot run more than ${result.hitParallelWorkspaceLimit.max} workspaces at the same time. Please stop a workspace before starting another one.`);
        }
    }

    protected requireEELicense(feature: Feature) {
        if (!this.licenseEvaluator.isEnabled(feature)) {
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
                msg: "maximum number of users reached"
            };
        }

        return { valid: true };
    }

    public async setWorkspaceTimeout(ctx: TraceContext, workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult> {
        traceAPIParams(ctx, { workspaceId, duration });
        traceWI(ctx, { workspaceId });

        this.requireEELicense(Feature.FeatureSetTimeout);
        const user = this.checkUser("setWorkspaceTimeout");

        if (!WorkspaceTimeoutValues.includes(duration)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Invalid duration")
        }

        if (!(await this.maySetTimeout(user))) {
            throw new ResponseError(ErrorCodes.PLAN_PROFESSIONAL_REQUIRED, "Plan upgrade is required")
        }

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        const runningInstances = await this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
        const runningInstance = runningInstances.find(i => i.workspaceId === workspaceId);
        if (!runningInstance) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Can only set keep-alive for running workspaces");
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "update");

        // if any other running instance has a custom timeout other than the user's default, we'll reset that timeout
        const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
        const defaultTimeout = await this.userService.getDefaultWorkspaceTimeout(user);
        const instancesWithReset = runningInstances.filter(i =>
            i.workspaceId !== workspaceId &&
            i.status.timeout !== defaultTimeout &&
            i.status.phase === "running"
        );
        await Promise.all(instancesWithReset.map(i => {
            const req = new SetTimeoutRequest();
            req.setId(i.id);
            req.setDuration(defaultTimeout);

            return client.setTimeout(ctx, req);
        }));

        const req = new SetTimeoutRequest();
        req.setId(runningInstance.id);
        req.setDuration(duration);
        await client.setTimeout(ctx, req);

        return {
            resetTimeoutOnWorkspaces: instancesWithReset.map(i => i.workspaceId)
        }
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
            log.warn({ userId: user.id, workspaceId }, 'Can only get keep-alive for running workspaces');
            return { duration: "30m", canChange };
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "get");

        const req = new DescribeWorkspaceRequest();
        req.setId(runningInstance.id);

        const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
        const desc = await client.describeWorkspace(ctx, req);
        const duration = desc.getStatus()!.getSpec()!.getTimeout() as WorkspaceTimeoutDuration;
        return { duration, canChange };
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
        return this.eligibilityService.maySetTimeout(user);
    }

    public async controlAdmission(ctx: TraceContext, workspaceId: string, level: "owner" | "everyone"): Promise<void> {
        traceAPIParams(ctx, { workspaceId, level });
        traceWI(ctx, { workspaceId });

        this.requireEELicense(Feature.FeatureWorkspaceSharing);
        this.checkAndBlockUser('controlAdmission');

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

            const client = await this.workspaceManagerClientProvider.get(instance.region);
            await client.controlAdmission(ctx, req);
        }

        await this.workspaceDb.trace(ctx).transaction(async db => {
            workspace.shareable = level === 'everyone';
            await db.store(workspace);
        });
    }

    async takeSnapshot(ctx: TraceContext, options: GitpodServer.TakeSnapshotOptions): Promise<string> {
        traceAPIParams(ctx, { options });
        const { workspaceId, dontWait } = options;
        traceWI(ctx, { workspaceId });

        this.requireEELicense(Feature.FeatureSnapshot);
        const user = this.checkAndBlockUser("takeSnapshot");

        const workspace = await this.guardSnaphotAccess(ctx, user.id, workspaceId);

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!instance) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace}, "get");

        const client = await this.workspaceManagerClientProvider.get(instance.region);
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
            SafePromise.catchAndLog(this.internalDoWaitForWorkspace(waitOpts), { userId: user.id, workspaceId: workspaceId})
        }

        return snapshot.id;
    }

    protected async guardSnaphotAccess(ctx: TraceContext, userId: string, workspaceId: string) : Promise<Workspace> {
        traceAPIParams(ctx, { userId, workspaceId });

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace || workspace.ownerId !== userId) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
        }
        await this.guardAccess({ kind: "snapshot", subject: undefined, workspaceOwnerID: workspace.ownerId, workspaceID: workspace.id }, "create");

        return workspace;
    }

    /**
     * @param snapshotId
     * @throws ResponseError with either NOT_FOUND or SNAPSHOT_ERROR in case the snapshot is not done yet.
     */
    async waitForSnapshot(ctx: TraceContext, snapshotId: string): Promise<void> {
        traceAPIParams(ctx, { snapshotId });

        this.requireEELicense(Feature.FeatureSnapshot);
        const user = this.checkAndBlockUser("waitForSnapshot");

        const snapshot = await this.workspaceDb.trace(ctx).findSnapshotById(snapshotId);
        if (!snapshot) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `No snapshot with id '${snapshotId}' found.`)
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
        await Promise.all(snapshots.map(s => this.guardAccess({ kind: "snapshot", subject: s, workspaceOwnerID: workspace.ownerId }, "get")));

        return snapshots.map(s => s.id);
    }


    async adminGetUsers(ctx: TraceContext, req: AdminGetListRequest<User>): Promise<AdminGetListResult<User>> {
        traceAPIParams(ctx, { req: censor(req, "searchTerm") });    // searchTerm may contain PII

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetUsers", { req }, Permission.ADMIN_USERS);

        try {
            const res = await this.userDB.findAllUsers(req.offset, req.limit, req.orderBy, req.orderDir === "asc" ? "ASC" : "DESC", req.searchTerm);
            res.rows = res.rows.map(this.censorUser);
            return res;
        } catch (e) {
            throw new ResponseError(500, e.toString());
        }
    }

    async adminGetUser(ctx: TraceContext, userId: string): Promise<User> {
        traceAPIParams(ctx, { userId });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetUser", { id: userId }, Permission.ADMIN_USERS);

        let result: User | undefined;
        try {
            result = await this.userDB.findUserById(userId);
        } catch (e) {
            throw new ResponseError(500, e.toString());
        }

        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
        }
        return this.censorUser(result);
    }

    async adminBlockUser(ctx: TraceContext, req: AdminBlockUserRequest): Promise<User> {
        traceAPIParams(ctx, { req });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminBlockUser", { req }, Permission.ADMIN_USERS);

        const target = await this.userDB.findUserById(req.id);
        if (!target) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
        }

        target.blocked = !!req.blocked;
        await this.userDB.storeUser(target);

        const workspaceDb = this.workspaceDb.trace(ctx);
        const workspaces = await workspaceDb.findWorkspacesByUser(req.id);
        const isDefined = <T>(x: T | undefined): x is T => x !== undefined;
        (await Promise.all(workspaces.map((workspace) => workspaceDb.findRunningInstance(workspace.id))))
            .filter(isDefined)
            .forEach(instance => this.internalStopWorkspaceInstance(ctx, instance.id, instance.region, StopWorkspacePolicy.IMMEDIATELY));

        // For some reason, returning the result of `this.userDB.storeUser(target)` does not work. The response never arrives the caller.
        // Returning `target` instead (which should be equivalent).
        return this.censorUser(target);
    }

    async adminDeleteUser(ctx: TraceContext, userId: string): Promise<void> {
        traceAPIParams(ctx, { userId });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminDeleteUser", { id: userId }, Permission.ADMIN_USERS);

        try {
            await this.userDeletionService.deleteUser(userId);
        } catch (e) {
            throw new ResponseError(500, e.toString());
        }
    }

    async adminModifyRoleOrPermission(ctx: TraceContext, req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        traceAPIParams(ctx, { req });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminModifyRoleOrPermission", { req }, Permission.ADMIN_USERS);

        const target = await this.userDB.findUserById(req.id);
        if (!target) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
        }

        const rolesOrPermissions = new Set((target.rolesOrPermissions || []) as string[]);
        req.rpp.forEach(e => {
            if (e.add) {
                rolesOrPermissions.add(e.r as string);
            } else {
                rolesOrPermissions.delete(e.r as string)
            }
        })
        target.rolesOrPermissions = Array.from(rolesOrPermissions.values()) as RoleOrPermission[];

        await this.userDB.storeUser(target);
        // For some reason, neither returning the result of `this.userDB.storeUser(target)` nor returning `target` work.
        // The response never arrives the caller.
        // Returning the following works at the cost of an additional DB query:
        return this.censorUser((await this.userDB.findUserById(req.id))!);
    }

    async adminModifyPermanentWorkspaceFeatureFlag(ctx: TraceContext, req: AdminModifyPermanentWorkspaceFeatureFlagRequest): Promise<User> {
        traceAPIParams(ctx, { req });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminModifyPermanentWorkspaceFeatureFlag", { req }, Permission.ADMIN_USERS);
        const target = await this.userDB.findUserById(req.id);
        if (!target) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
        }

        const featureSettings: UserFeatureSettings = target.featureFlags || {};
        const featureFlags = new Set(featureSettings.permanentWSFeatureFlags || []);

        req.changes.forEach(e => {
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

    async adminGetWorkspaces(ctx: TraceContext, req: AdminGetWorkspacesRequest): Promise<AdminGetListResult<WorkspaceAndInstance>> {
        traceAPIParams(ctx, { req });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetWorkspaces", { req }, Permission.ADMIN_WORKSPACES);

        return await this.workspaceDb.trace(ctx).findAllWorkspaceAndInstances(req.offset, req.limit, req.orderBy, req.orderDir === "asc" ? "ASC" : "DESC", req, req.searchTerm);
    }

    async adminGetWorkspace(ctx: TraceContext, workspaceId: string): Promise<WorkspaceAndInstance> {
        traceAPIParams(ctx, { workspaceId });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetWorkspace", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        const result = await this.workspaceDb.trace(ctx).findWorkspaceAndInstance(workspaceId);
        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
        }
        return result;
    }

    async adminForceStopWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminForceStopWorkspace", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (workspace) {
            await this.internalStopWorkspace(ctx, workspace, StopWorkspacePolicy.IMMEDIATELY, true);
        }
    }

    async adminRestoreSoftDeletedWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });

        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminRestoreSoftDeletedWorkspace", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        await this.workspaceDb.trace(ctx).transaction(async db => {
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
            ws.softDeletedTime = '';
            ws.pinned = true;
            await db.store(ws);
        });
    }

    protected async guardAdminAccess(method: string, params: any, requiredPermission: PermissionName) {
        const user = this.checkAndBlockUser(method);
        if (!this.authorizationService.hasPermission(user, requiredPermission)) {
            log.warn({ userId: this.user?.id }, "unauthorised admin access", { authorised: false, method, params });
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }
        log.info({ userId: this.user?.id }, "admin access", { authorised: true, method, params });
    }

    protected async findPrebuiltWorkspace(parentCtx: TraceContext, user: User, context: WorkspaceContext, mode: CreateWorkspaceMode): Promise<WorkspaceCreationResult | PrebuiltWorkspaceContext | undefined> {
        const ctx = TraceContext.childContext("findPrebuiltWorkspace", parentCtx);

        if (!(CommitContext.is(context) && context.repository.cloneUrl && context.revision)) {
            return;
        }

        const logCtx: LogContext = { userId: user.id };
        const cloneUrl = context.repository.cloneUrl;
        // Note: findPrebuiltWorkspaceByCommit always returns the last triggered prebuild (so, if you re-trigger a prebuild, the newer one will always be used here)
        const prebuiltWorkspace = await this.workspaceDb.trace(ctx).findPrebuiltWorkspaceByCommit(cloneUrl, context.revision);
        const logPayload = { mode, cloneUrl, commit: context.revision, prebuiltWorkspace };
        log.debug(logCtx, "Looking for prebuilt workspace: ", logPayload);
        if (!prebuiltWorkspace) {
            return;
        }

        if (prebuiltWorkspace.state === 'available') {
            log.info(logCtx, `Found prebuilt workspace for ${cloneUrl}:${context.revision}`, logPayload);
            const result: PrebuiltWorkspaceContext = {
                title: context.title,
                originalContext: context,
                prebuiltWorkspace
            };
            return result;
        } else if (prebuiltWorkspace.state === 'queued' || prebuiltWorkspace.state === 'building') {
            if (mode === CreateWorkspaceMode.ForceNew) {
                // in force mode we ignore running prebuilds as we want to start a workspace as quickly as we can.
                return;
                // TODO(janx): Fall back to parent prebuild instead, if it's available:
                //   const buildWorkspace = await this.workspaceDb.trace({span}).findById(prebuiltWorkspace.buildWorkspaceId);
                //   const parentPrebuild = await this.workspaceDb.trace({span}).findPrebuildByID(buildWorkspace.basedOnPrebuildId);
                // Also, make sure to initialize it by both printing the parent prebuild logs AND re-runnnig the before/init/prebuild tasks.
            }

            const workspaceID = prebuiltWorkspace.buildWorkspaceId;
            const makeResult = (instanceID: string): WorkspaceCreationResult => {
                return <WorkspaceCreationResult>{
                    runningWorkspacePrebuild: {
                        prebuildID: prebuiltWorkspace.id,
                        workspaceID,
                        instanceID,
                        starting: 'queued',
                        sameCluster: false,
                    }
                };
            };

            const wsi = await this.workspaceDb.trace(ctx).findCurrentInstance(workspaceID);
            if (!wsi || wsi.stoppedTime !== undefined) {
                if (prebuiltWorkspace.state === 'queued') {
                    if (Date.now() - Date.parse(prebuiltWorkspace.creationTime) > 1000 * 60) {
                        // queued for long than a minute? Let's retrigger
                        console.warn('Retriggering queued prebuild.', prebuiltWorkspace);
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
            const result = makeResult(wsi.id);

            const inSameCluster = wsi.region === this.config.installationShortname;
            if (!inSameCluster) {
                if (mode === CreateWorkspaceMode.UsePrebuild) {
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
                    const finishedPrebuiltWorkspace = await this.pollDatabaseUntilPrebuildIsAvailable(ctx, prebuiltWorkspace.id, 20000);
                    if (!finishedPrebuiltWorkspace) {
                        log.warn(logCtx, "did not find a finished prebuild in the database despite waiting long enough after msgbus confirmed that the prebuild had finished", logPayload);
                        return;
                    } else {
                        return { title: context.title, originalContext: context, prebuiltWorkspace: finishedPrebuiltWorkspace } as PrebuiltWorkspaceContext;
                    }
                }
            }

            /* This is the default mode behaviour: we present the running prebuild to the user so that they can see the logs
            * or choose to force the creation of a workspace.
            */
            if (wsi.status.phase != 'running') {
                result.runningWorkspacePrebuild!.starting = 'starting';
            } else {
                result.runningWorkspacePrebuild!.starting = 'running';
            }
            log.info(logCtx, `Found prebuilding (starting=${result.runningWorkspacePrebuild!.starting}) workspace for ${cloneUrl}:${context.revision}`, logPayload);
            return result;
        }
    }

    async adminSetLicense(ctx: TraceContext, key: string): Promise<void> {
        traceAPIParams(ctx, { });   // don't trace the actual key

        await this.guardAdminAccess("adminGetWorkspaces", { key }, Permission.ADMIN_API);

        await this.licenseDB.store(uuidv4(), key);
        await this.licenseEvaluator.reloadLicense();
    }

    // TODO(gpl) This is not part of our API interface, nor can I find any clients. Remove or re-surrect?
    // async getLicenseInfo(ctx: TraceContext): Promise<GetLicenseInfoResult> {
    //     const user = this.checkAndBlockUser("getLicenseInfo");

    //     const { key } = await this.licenseKeySource.getKey();
    //     const { validUntil, seats } = this.licenseEvaluator.inspect();
    //     const { valid } = this.licenseEvaluator.validate();

    //     const isAdmin = this.authorizationService.hasPermission(user, Permission.ADMIN_API);

    //     return {
    //         isAdmin,
    //         licenseInfo: {
    //             key: isAdmin ? key : "REDACTED",
    //             seats,
    //             valid,
    //             validUntil
    //         }
    //     };
    // }

    async licenseIncludesFeature(ctx: TraceContext, licenseFeature: LicenseFeature): Promise<boolean> {
        traceAPIParams(ctx, { licenseFeature });

        this.checkAndBlockUser("licenseIncludesFeature");

        let feature: Feature | undefined;
        switch (licenseFeature) {
            case LicenseFeature.CreateSnapshot:
                feature = Feature.FeatureSnapshot
            // room for more
            default:
        }
        if (feature) {
            return this.licenseEvaluator.isEnabled(feature);
        }
        return false;
    }

    // (SaaS) – accounting
    public async getAccountStatement(ctx: TraceContext, options: GitpodServer.GetAccountStatementOptions): Promise<AccountStatement> {
        traceAPIParams(ctx, { options });

        const user = this.checkUser("getAccountStatement");
        const now = options.date || new Date().toISOString();
        return this.accountStatementProvider.getAccountStatement(user.id, now);
    }

    public async getRemainingUsageHours(ctx: TraceContext): Promise<number> {
        const user = this.checkUser("getRemainingUsageHours");
        const runningInstancesPromise = this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
        return this.accountStatementProvider.getRemainingUsageHours(user.id, new Date().toISOString(), runningInstancesPromise);
    }

    // (SaaS) – payment/billing
    async getAvailableCoupons(ctx: TraceContext): Promise<PlanCoupon[]> {
        const user = this.checkUser('getAvailableCoupons');
        const couponIds = await this.couponComputer.getAvailableCouponIds(user);
        return this.getChargebeePlanCoupons(ctx, couponIds);
    }

    async getAppliedCoupons(ctx: TraceContext): Promise<PlanCoupon[]> {
        const user = this.checkUser('getAppliedCoupons');
        const couponIds = await this.couponComputer.getAppliedCouponIds(user, new Date());
        return this.getChargebeePlanCoupons(ctx, couponIds);
    }

    // chargebee
    async getChargebeeSiteId(ctx: TraceContext): Promise<string> {
        this.checkUser('getChargebeeSiteId');
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

    async getShowPaymentUI(ctx: TraceContext): Promise<boolean> {
        this.checkUser('getShowPaymentUI');
        return !!this.config.enablePayment;
    }

    async isChargebeeCustomer(ctx: TraceContext): Promise<boolean> {
        const user = this.checkUser('isChargebeeCustomer');

        return await new Promise<boolean>((resolve, reject) => {
            this.chargebeeProvider.customer
                .retrieve(user.id)
                .request((error, result) => {
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

        const chargebeeCoupons = await Promise.all(couponIds.map(c => new Promise<chargebee.Coupon | undefined>((resolve, reject) => this.chargebeeProvider.coupon.retrieve(c).request((err, res) => {
            if (!!err) {
                log.error({}, "could not retrieve coupon: " + err.message, { coupon: c })
                resolve(undefined);
            } else if (!!res) {
                resolve(res.coupon);
            } else {
                resolve(undefined);
            }
        }))));

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
        const user = this.checkUser('createPortalSession');
        const logContext = { userId: user.id };

        return await new Promise((resolve, reject) => {
            this.chargebeeProvider.portal_session.create({
                customer: {
                    id: user.id
                }
            }).request(function (error: any, result: any) {
                if (error) {
                    log.error(logContext, 'User portal session creation error', error);
                    reject(error);
                } else {
                    log.debug(logContext, 'User portal session created');
                    resolve(result.portal_session);
                }
            });
        });
    }

    async checkout(ctx: TraceContext, planId: string, planQuantity?: number): Promise<{}> {
        traceAPIParams(ctx, { planId, planQuantity });

        const user = this.checkUser('checkout');
        const logContext = { userId: user.id };

        // Throws an error if not the case
        await this.ensureIsEligibleForPlan(user, planId);

        const coupon = await this.findAvailableCouponForPlan(user, planId);

        try {
            const email = User.getPrimaryEmail(user);

            return new Promise((resolve, reject) => {
                this.chargebeeProvider.hosted_page.checkout_new({
                    customer: {
                        id: user.id,
                        email
                    },
                    subscription: {
                        plan_id: planId,
                        plan_quantity: planQuantity,
                        coupon
                    }
                }).request((error: any, result: any) => {
                    if (error) {
                        log.error(logContext, 'Checkout page error', error);
                        reject(error);
                    } else {
                        log.debug(logContext, 'Checkout page initiated');
                        resolve(result.hosted_page);
                    }
                });
            });
        } catch (err) {
            log.error(logContext, 'Checkout error', err);
            throw err;
        }
    }

    protected async findAvailableCouponForPlan(user: User, planId: string): Promise<string | undefined> {
        const couponNames = await this.couponComputer.getAvailableCouponIds(user);
        const chargbeeCoupons = await Promise.all(couponNames.map(c => new Promise<chargebee.Coupon | undefined>((resolve, reject) => this.chargebeeProvider.coupon.retrieve(c).request((err, res) => {
            if (!!err) {
                log.error({}, "could not retrieve coupon: " + err.message, { coupon: c })
                resolve(undefined);
            } else if (!!res) {
                resolve(res.coupon);
            } else {
                resolve(undefined);
            }
        }))));
        const applicableCoupon = chargbeeCoupons
            .filter(c => c && c.discount_percentage && c.plan_ids && c.plan_ids.indexOf(planId) != -1)
            .sort((a, b) => a!.discount_percentage! < b!.discount_percentage! ? -1 : 1)
        [0];
        return applicableCoupon ? applicableCoupon.id : undefined;
    }

    async subscriptionUpgradeTo(ctx: TraceContext, subscriptionId: string, chargebeePlanId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId, chargebeePlanId });

        const user = this.checkUser('subscriptionUpgradeTo');
        await this.ensureIsEligibleForPlan(user, chargebeePlanId);
        await this.doUpdateUserPaidSubscription(user.id, subscriptionId, chargebeePlanId, false);
    }

    async subscriptionDowngradeTo(ctx: TraceContext, subscriptionId: string, chargebeePlanId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId, chargebeePlanId });

        const user = this.checkUser('subscriptionDowngradeTo');
        await this.ensureIsEligibleForPlan(user, chargebeePlanId);
        await this.doUpdateUserPaidSubscription(user.id, subscriptionId, chargebeePlanId, true);
    }

    protected async ensureIsEligibleForPlan(user: User, chargebeePlanId: string): Promise<void> {
        const p = Plans.getById(chargebeePlanId);
        if (!p) {
            log.error({ userId: user.id }, 'Invalid plan', { planId: chargebeePlanId });
            throw new Error(`Invalid plan: ${chargebeePlanId}`);
        }

        if (p.type === 'student') {
            const isStudent = await this.eligibilityService.isStudent(user);
            if (!isStudent) {
                throw new ResponseError(ErrorCodes.PLAN_ONLY_ALLOWED_FOR_STUDENTS, "This plan is only allowed for students");
            }
        }
    }

    async subscriptionCancel(ctx: TraceContext, subscriptionId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId });

        const user = this.checkUser('subscriptionCancel');
        const chargebeeSubscriptionId = await this.doGetUserPaidSubscription(user.id, subscriptionId);
        await this.chargebeeService.cancelSubscription(chargebeeSubscriptionId, { userId: user.id }, { subscriptionId, chargebeeSubscriptionId });
    }

    async subscriptionCancelDowngrade(ctx: TraceContext, subscriptionId: string): Promise<void> {
        traceAPIParams(ctx, { subscriptionId });

        const user = this.checkUser('subscriptionCancelDowngrade');
        await this.doCancelDowngradeUserPaidSubscription(user.id, subscriptionId);
    }

    protected async doUpdateUserPaidSubscription(userId: string, subscriptionId: string, newPlanId: string, applyEndOfTerm: boolean) {
        const chargebeeSubscriptionId = await this.doGetUserPaidSubscription(userId, subscriptionId);
        return this.doUpdateSubscription(userId, chargebeeSubscriptionId, {
            plan_id: newPlanId,
            end_of_term: applyEndOfTerm
        });
    }

    protected async doUpdateSubscription(userId: string, chargebeeSubscriptionId: string, update: Partial<chargebee.SubscriptionUpdateParams> = {}) {
        const logContext = { userId };
        const logPayload = { chargebeeSubscriptionId, update };
        return await new Promise<void>((resolve, reject) => {
            this.chargebeeProvider.subscription.update(chargebeeSubscriptionId, {
                ...update
            }).request((error: any, result: any) => {
                if (error) {
                    log.error(logContext, 'Chargebee Subscription update error', error, logPayload);
                    reject(error);
                } else {
                    log.debug(logContext, 'Chargebee Subscription updated', logPayload);
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
            this.chargebeeProvider.subscription.remove_scheduled_changes(chargebeeSubscriptionId)
                .request((error: any, result: any) => {
                    if (error) {
                        log.error(logContext, 'Chargebee remove scheduled change to Subscription error', error, logPayload);
                        reject(error);
                    } else {
                        log.debug(logContext, 'Chargebee scheduled change to Subscription removed', logPayload);
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

    // Team Subscriptions
    async tsGet(ctx: TraceContext): Promise<TeamSubscription[]> {
        const user = this.checkUser('getTeamSubscriptions');
        return this.teamSubscriptionDB.findTeamSubscriptionsForUser(user.id, new Date().toISOString());
    }

    async tsGetSlots(ctx: TraceContext): Promise<TeamSubscriptionSlotResolved[]> {
        const user = this.checkUser('tsGetSlots');
        return this.teamSubscriptionService.findTeamSubscriptionSlotsBy(user.id, new Date());
    }

    async tsGetUnassignedSlot(ctx: TraceContext, teamSubscriptionId: string): Promise<TeamSubscriptionSlot | undefined> {
        traceAPIParams(ctx, { teamSubscriptionId });

        this.checkUser('tsGetUnassignedSlot');
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

        const user = this.checkAndBlockUser('tsAddSlots');
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
            log.error({ userId: user.id }, 'tsAddSlots', err);
        }
    }

    async tsAssignSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string, identityStr: string | undefined): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId });    // identityStr contains PII

        const user = this.checkAndBlockUser('tsAssignSlot');
        // assigning a slot can be done by third users
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, identityStr ? user.id : undefined);
        const logCtx = { userId: user.id };

        try {
            // Verify assignee:
            //  - must be existing Gitpod user, uniquely identifiable per GitHub/GitLab/Bitbucket name
            //  - in case of Student Subscription: Must be a student
            const assigneeInfo: FindUserByIdentityStrResult = identityStr ? (await this.findAssignee(logCtx, identityStr)) : (await this.getAssigneeInfo(ctx, user));
            const { user: assignee, identity: assigneeIdentity, authHost } = assigneeInfo;
            // check here that current user is either the assignee or assigner.
            await this.ensureMayGetAssignedToTS(ts, user, assignee);

            const assigneeIdentifier: AssigneeIdentityIdentifier = { identity: { authHost, authName: assigneeIdentity.authName } };
            await this.teamSubscriptionService.assignSlot(ts, teamSubscriptionSlotId, assignee, assigneeIdentifier, new Date());
        } catch (err) {
            log.debug(logCtx, 'tsAssignSlot', err);
            throw err;
        }
    }

    // Find an (identity, authHost) tuple that uniquely identifies a user (to generate an `identityStr`).
    protected async getAssigneeInfo(ctx: TraceContext, user: User) {
        const authProviders = await this.getAuthProviders(ctx);
        for (const identity of user.identities) {
            const provider = authProviders.find(p => p.authProviderId === identity.authProviderId);
            if (provider && provider.host) {
                return { user, identity, authHost: provider.host };
            }
        }
        throw new ResponseError(ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED, 'Could not find a unique identifier for assignee.');
    }

    protected async ensureMayGetAssignedToTS(ts: TeamSubscription, user: User, assignee: User) {
        if (user.id !== ts.userId && user.id !== assignee.id) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Only the owner or the assignee may assign a team subscription!");
        }
        const slots = await this.teamSubscriptionDB.findSlotsByAssignee(assignee.id);
        const now = (new Date()).toISOString();
        const assignedSlots = slots.filter(slot => TeamSubscriptionSlot.status(slot, now) === 'assigned');
        if (assignedSlots.length > 0) {
            if (assignedSlots.some(slot => slot.teamSubscriptionId === ts.id)) {
                throw new ResponseError(ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED, `The assignee already has a slot in this team subsciption.`);
            } else {
                throw new ResponseError(ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED, `Can not assign a slot in the team subsciption because the assignee already has a slot in another team subscription.`);
            }
        }
        await this.ensureIsEligibleForPlan(assignee, ts.planId);
    }

    async tsReassignSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string, newIdentityStr: string): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId });    // newIdentityStr contains PII

        const user = this.checkAndBlockUser('tsReassignSlot');
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, user.id);
        const logCtx = { userId: user.id };
        const assigneeInfo = await this.findAssignee(logCtx, newIdentityStr);

        try {
            const now = new Date();
            const { user: assignee, identity: assigneeIdentity, authHost } = assigneeInfo;
            const assigneeIdentifier: AssigneeIdentityIdentifier = { identity: { authHost, authName: assigneeIdentity.authName } };
            await this.teamSubscriptionService.reassignSlot(ts, teamSubscriptionSlotId, assignee, assigneeIdentifier, now);
        } catch (err) {
            log.error(logCtx, 'tsReassignSlot', err);
        }
    }

    protected readonly findAssigneeThrottled: ThrottledFunction<any[], FindUserByIdentityStrResult> = pThrottle(async (logCtx: LogContext, identityStr: string): Promise<FindUserByIdentityStrResult> => {
        let assigneeInfo = undefined;
        try {
            assigneeInfo = await this.userService.findUserByIdentityStr(identityStr);
        } catch (err) {
            log.error(logCtx, err);
        }
        if (!assigneeInfo) {
            throw new ResponseError(ErrorCodes.TEAM_SUBSCRIPTION_ASSIGNMENT_FAILED, `Gitpod user not found`, { msg: `Gitpod user not found` });
        }
        return assigneeInfo;
    }, 1, 1000);

    protected async findAssignee(logCtx: LogContext, identityStr: string) {
        return await this.findAssigneeThrottled(logCtx, identityStr);
    }

    protected updateTeamSubscriptionQueue = new Queue();

    async tsDeactivateSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId });

        const user = this.checkAndBlockUser('tsDeactivateSlot');
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, user.id);

        this.updateTeamSubscriptionQueue.enqueue(async () => {
            // Check number of currently active slots
            const newQuantity = (await this.tsGetActiveSlotQuantity(teamSubscriptionId)) - 1;
            try {
                const now = new Date();
                // Downgrade by 1 unit
                await this.doUpdateTeamSubscription(user.id, ts.id, newQuantity, false);
                await this.teamSubscriptionService.deactivateSlot(ts, teamSubscriptionSlotId, now);
            } catch (err) {
                log.error({ userId: user.id }, 'tsDeactivateSlot', err);
            }
        });
    }

    async tsReactivateSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void> {
        traceAPIParams(ctx, { teamSubscriptionId, teamSubscriptionSlotId });

        const user = this.checkAndBlockUser('tsReactivateSlot');
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, user.id);

        this.updateTeamSubscriptionQueue.enqueue(async () => {
            // Check number of currently active slots
            const newQuantity = (await this.tsGetActiveSlotQuantity(teamSubscriptionId)) + 1;
            try {
                const now = new Date();
                // Upgrade by 1 unit (but don't charge again!)
                await this.doUpdateTeamSubscription(user.id, ts.id, newQuantity, false);
                await this.teamSubscriptionService.reactivateSlot(ts, teamSubscriptionSlotId, now);
            } catch (err) {
                log.error({ userId: user.id }, 'tsReactivateSlot', err);
            }
        });
    }

    async getGithubUpgradeUrls(ctx: TraceContext): Promise<GithubUpgradeURL[]> {
        const user = this.checkUser('getGithubUpgradeUrls');
        const ghidentity = user.identities.find(i => i.authProviderId == "Public-GitHub");
        if (!ghidentity) {
            log.debug({ userId: user.id }, "user has no GitHub identity - cannot provide plan upgrade URLs");
            return [];
        }
        const produceUpgradeURL = (planID: number) => `https://www.github.com/marketplace/${this.config.githubApp?.marketplaceName}/upgrade/${planID}/${ghidentity.authId}`;

        // GitHub plans are USD
        return Plans.getAvailablePlans('USD')
            .filter(p => !!p.githubId && !!p.githubPlanNumber)
            .map(p => <GithubUpgradeURL>{ url: produceUpgradeURL(p.githubPlanNumber!), planID: p.githubId! });
    }

    protected async doChargeForTeamSubscriptionUpgrade(ts: TeamSubscription, oldQuantity: number, newQuantity: number, upgradeTimestamp: string) {
        const chargebeeSubscriptionId = ts.paymentReference!;   // Was checked before

        if (oldQuantity < newQuantity) {
            // Upgrade: Charge for it!
            const pricePerUnitInCents = await this.getPricePerUnitInCents(ts, chargebeeSubscriptionId);
            const diffInCents = pricePerUnitInCents * (newQuantity - oldQuantity);
            const description = `Difference on Upgrade from '${oldQuantity}' to '${newQuantity}' units (${formatDate(upgradeTimestamp)})`;
            await this.upgradeHelper.chargeForUpgrade(ts.userId, chargebeeSubscriptionId, diffInCents, description, upgradeTimestamp);
        }
    }

    protected async getPricePerUnitInCents(ts: TeamSubscription, chargebeeSubscriptionId: string): Promise<number> {
        const chargebeeSubscription = await this.getChargebeeSubscription({ userId: ts.userId }, chargebeeSubscriptionId);
        const subscriptionPlanUnitPriceInCents = chargebeeSubscription.plan_unit_price;
        if (subscriptionPlanUnitPriceInCents === undefined) {
            const plan = Plans.getById(ts.planId)!;
            return plan.pricePerMonth * 100;
        } else {
            return subscriptionPlanUnitPriceInCents;
        }
    }

    protected async getChargebeeSubscription(logCtx: LogContext, chargebeeSubscriptionId: string): Promise<chargebee.Subscription> {
        const logPayload = { chargebeeSubscriptionId: chargebeeSubscriptionId };
        const retrieveResult = await new Promise<chargebee.SubscriptionRetrieveResult>((resolve, reject) => {
            this.chargebeeProvider.subscription.retrieve(chargebeeSubscriptionId).request(function (error: any, result: any) {
                if (error) {
                    log.error(logCtx, 'Retrieve subscription: error', error, logPayload);
                    reject(error);
                } else {
                    log.debug(logCtx, 'Retrieve subscription: successful', logPayload);
                    resolve(result);
                }
            });
        });
        return retrieveResult.subscription;
    }

    protected async doUpdateTeamSubscription(userId: string, teamSubscriptionId: string, newQuantity: number, applyEndOfTerm: boolean) {
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
            end_of_term: applyEndOfTerm
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

    // (SaaS) – admin
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
            await this.subscriptionService.subscribe(userId, Plans.FREE_OPEN_SOURCE, undefined, new Date().toISOString());
        } else {
            await this.subscriptionService.unsubscribe(userId, new Date().toISOString(), Plans.FREE_OPEN_SOURCE.chargebeeId);
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
            domain: domain.toLowerCase()
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

    // various
    async sendFeedback(ctx: TraceContext, feedback: string): Promise<string | undefined> {
        traceAPIParams(ctx, { });   // feedback is not interesting here, any may contain names

        const user = this.checkUser("sendFeedback");
        const now = new Date().toISOString();
        const remainingUsageHours = await this.getRemainingUsageHours(ctx);
        const stillEnoughCredits = remainingUsageHours > Math.max(...Accounting.LOW_CREDIT_WARNINGS_IN_HOURS);
        log.info({ userId: user.id }, `Feedback: "${feedback}"`, { feedback, stillEnoughCredits });
        if (stillEnoughCredits) {
            return 'Thank you for your feedback.';
        }
        await this.subscriptionService.addCredit(user.id, 50, now);
        return 'Thank you for you feedback. We have added 50 Gitpod Hours to your account. Have fun!';
    }

    // Projects
    async getProviderRepositoriesForUser(ctx: TraceContext, params: { provider: string, hints?: object }): Promise<ProviderRepository[]> {
        traceAPIParams(ctx, { params });

        const user = this.checkAndBlockUser("getProviderRepositoriesForUser");

        const repositories: ProviderRepository[] = [];
        const providerHost = params.provider;
        const provider = (await this.getAuthProviders(ctx)).find(ap => ap.host === providerHost);

        if (providerHost === "github.com") {
            repositories.push(...(await this.githubAppSupport.getProviderRepositoriesForUser({ user, ...params })));
        } else if (providerHost === "bitbucket.org" && provider) {
            repositories.push(...(await this.bitbucketAppSupport.getProviderRepositoriesForUser({ user, provider })));
        } else if (provider?.authProviderType === "GitLab") {
            repositories.push(...(await this.gitLabAppSupport.getProviderRepositoriesForUser({ user, provider })));
        } else {
            log.info({ userId: user.id }, `Unsupported provider: "${params.provider}"`, { params });
        }
        const projects = await this.projectsService.getProjectsByCloneUrls(repositories.map(r => r.cloneUrl));

        const cloneUrlToProject = new Map(projects.map(p => [p.cloneUrl, p]));

        for (const repo of repositories) {
            const p = cloneUrlToProject.get(repo.cloneUrl);
            const repoProvider = new URL(repo.cloneUrl).host.split(".")[0];

            if (p) {
                if (p.userId) {
                    const owner = await this.userDB.findUserById(p.userId);
                    if (owner) {
                        const ownerProviderMatchingRepoProvider = owner.identities.find((identity, index) => identity.authProviderId.toLowerCase().includes(repoProvider));
                        if (ownerProviderMatchingRepoProvider) {
                            repo.inUse = {
                                userName: ownerProviderMatchingRepoProvider?.authName
                            }
                        }
                    }
                } else if (p.teamOwners && p.teamOwners[0]) {
                    repo.inUse = {
                        userName: p.teamOwners[0] || 'somebody'
                    }
                }
            }
        }

        return repositories;
    }

    async triggerPrebuild(ctx: TraceContext, projectId: string, branchName: string | null): Promise<StartPrebuildResult> {
        traceAPIParams(ctx, { projectId, branchName });

        const user = this.checkAndBlockUser("triggerPrebuild");

        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "update");

        const branchDetails = (!!branchName
            ? await this.projectsService.getBranchDetails(user, project, branchName)
            : (await this.projectsService.getBranchDetails(user, project)).filter(b => b.isDefault));
        if (branchDetails.length !== 1) {
            log.debug({ userId: user.id }, 'Cannot find branch details.', { project, branchName });
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Could not find ${!branchName ? 'a default branch' : `branch '${branchName}'`} in repository ${project.cloneUrl}`);
        }
        const contextURL = branchDetails[0].url;

        const context = await this.contextParser.handle(ctx, user, contextURL) as CommitContext;

        const prebuild = await this.prebuildManager.startPrebuild(ctx, {
            contextURL,
            cloneURL: project.cloneUrl,
            commit: context.revision,
            user,
            branch: branchDetails[0].name,
            project
        });

        this.analytics.track({
            userId: user.id,
            event: "prebuild_triggered",
            properties: {
                context_url: contextURL,
                clone_url: project.cloneUrl,
                commit: context.revision,
                branch: branchDetails[0].name,
                project_id: project.id
            }
        });

        return prebuild;
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
        this.disposables.push(this.localMessageBroker.listenForPrebuildUpdates(
            project.id,
            (ctx: TraceContext, update: PrebuildWithStatus) => {
                this.client?.onPrebuildUpdate(update);
            }
        ));
        return project;
    }

}

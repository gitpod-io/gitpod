/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { GitpodServerImpl } from "../../../src/workspace/gitpod-server-impl";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { GitpodServer, GitpodClient, AdminGetListRequest, User, AdminGetListResult, Permission, AdminBlockUserRequest, AdminModifyRoleOrPermissionRequest, RoleOrPermission, AdminModifyPermanentWorkspaceFeatureFlagRequest, UserFeatureSettings, AdminGetWorkspacesRequest, WorkspaceAndInstance, GetWorkspaceTimeoutResult, WorkspaceTimeoutDuration, WorkspaceTimeoutValues, SetWorkspaceTimeoutResult, WorkspaceContext, CreateWorkspaceMode, WorkspaceCreationResult, PrebuiltWorkspaceContext, CommitContext, PrebuiltWorkspace, PermissionName, WorkspaceInstance, EduEmailDomain, ProviderRepository, Queue, PrebuildWithStatus, CreateProjectParams, Project, StartPrebuildResult, ClientHeaderFields } from "@gitpod/gitpod-protocol";
import { ResponseError } from "vscode-jsonrpc";
import { TakeSnapshotRequest, AdmissionLevel, ControlAdmissionRequest, StopWorkspacePolicy, DescribeWorkspaceRequest, SetTimeoutRequest } from "@gitpod/ws-manager/lib";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import * as opentracing from 'opentracing';
import * as uuidv4 from 'uuid/v4';
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { LicenseEvaluator, LicenseKeySource } from "@gitpod/licensor/lib";
import { Feature } from "@gitpod/licensor/lib/api";
import { LicenseValidationResult, GetLicenseInfoResult, LicenseFeature } from '@gitpod/gitpod-protocol/lib/license-protocol';
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { LicenseDB } from "@gitpod/gitpod-db/lib";
import { ResourceAccessGuard } from "../../../src/auth/resource-access";
import { MessageBusIntegration } from "../../../src/workspace/messagebus-integration";
import { MessageBusIntegrationEE } from "./messagebus-integration";
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

@injectable()
export class GitpodServerEEImpl extends GitpodServerImpl<GitpodClient, GitpodServer> {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(LicenseDB) protected readonly licenseDB: LicenseDB;
    @inject(LicenseKeySource) protected readonly licenseKeySource: LicenseKeySource;

    @inject(MessageBusIntegration) protected readonly messageBusIntegration: MessageBusIntegrationEE;

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

    @inject(Config) protected readonly config: Config;

    initialize(client: GitpodClient | undefined, user: User, accessGuard: ResourceAccessGuard, clientHeaderFields: ClientHeaderFields): void {
        super.initialize(client, user, accessGuard, clientHeaderFields);
        this.listenToCreditAlerts();
        this.listenForPrebuildUpdates();
    }

    protected async listenForPrebuildUpdates() {
        // 'registering for prebuild updates for all projects this user has access to
        const projects = await this.getAccessibleProjects();
        for (const projectId of projects) {
            this.disposables.push(this.messageBusIntegration.listenForPrebuildUpdates(
                (ctx: TraceContext, update: PrebuildWithStatus) => {
                    this.client?.onPrebuildUpdate(update);
                },
                projectId
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
        this.disposables.push(this.messageBusIntegration.listenToCreditAlerts(
            this.user.id,
            async (ctx: TraceContext, creditAlert: CreditAlert) => {
                this.client?.onCreditAlert(creditAlert);
                if (creditAlert.remainingUsageHours < 1e-6) {
                    const runningInstances = await this.workspaceDb.trace({}).findRegularRunningInstances(creditAlert.userId);
                    runningInstances.forEach(async instance => await this.stopWorkspace(instance.workspaceId));
                }
            }
        ))
    }

    // eligibility checks and extension points
    public async mayAccessPrivateRepo(): Promise<boolean> {
        const user = this.checkAndBlockUser("mayAccessPrivateRepo");
        return this.eligibilityService.mayOpenPrivateRepo(user, new Date());
    }

    protected async mayStartWorkspace(ctx: TraceContext, user: User, runningInstances: Promise<WorkspaceInstance[]>): Promise<void> {
        await super.mayStartWorkspace(ctx, user, runningInstances);

        const span = TraceContext.startSpan("mayStartWorkspace", ctx);

        try {
            const result = await this.eligibilityService.mayStartWorkspace(user, new Date(), runningInstances);
            if (!result.enoughCredits) {
                throw new ResponseError(ErrorCodes.NOT_ENOUGH_CREDIT, `Not enough credits. Please book more.`);
            }
            if (!!result.hitParallelWorkspaceLimit) {
                throw new ResponseError(ErrorCodes.TOO_MANY_RUNNING_WORKSPACES, `You cannot run more than ${result.hitParallelWorkspaceLimit.max} workspaces at the same time. Please stop a workspace before starting another one.`);
            }
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }



    protected async mayOpenContext(user: User, context: WorkspaceContext): Promise<void> {
        await super.mayOpenContext(user, context);

        const mayOpenContext = await this.eligibilityService.mayOpenContext(user, context, new Date())
        if (!mayOpenContext) {
            throw new ResponseError(ErrorCodes.PLAN_DOES_NOT_ALLOW_PRIVATE_REPOS, `You do not have a plan that allows for opening private repositories.`);
        }
    }

    protected requireEELicense(feature: Feature) {
        if (!this.licenseEvaluator.isEnabled(feature)) {
            throw new ResponseError(ErrorCodes.EE_LICENSE_REQUIRED, "enterprise license required");
        }
    }

    async validateLicense(): Promise<LicenseValidationResult> {
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

    public async setWorkspaceTimeout(workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult> {
        this.requireEELicense(Feature.FeatureSetTimeout);

        const user = this.checkUser("setWorkspaceTimeout");
        const span = opentracing.globalTracer().startSpan("setWorkspaceTimeout");
        span.setTag("workspaceId", workspaceId);
        span.setTag("userId", user.id);
        span.setTag("duration", duration);

        try {
            if (!WorkspaceTimeoutValues.includes(duration)) {
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Invalid duration")
            }

            if (!(await this.maySetTimeout(user))) {
                throw new ResponseError(ErrorCodes.PLAN_PROFESSIONAL_REQUIRED, "Plan upgrade is required")
            }

            const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({ span }));
            const runningInstances = await this.workspaceDb.trace({ span }).findRegularRunningInstances(user.id);
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

                return client.setTimeout({ span }, req);
            }));

            const req = new SetTimeoutRequest();
            req.setId(runningInstance.id);
            req.setDuration(duration);
            await client.setTimeout({ span }, req);

            return {
                resetTimeoutOnWorkspaces: instancesWithReset.map(i => i.workspaceId)
            }
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async getWorkspaceTimeout(workspaceId: string): Promise<GetWorkspaceTimeoutResult> {
        // Allowed in the free version, because it is read only.
        // this.requireEELicense(Feature.FeatureSetTimeout);

        const user = this.checkUser("getWorkspaceTimeout");
        const span = opentracing.globalTracer().startSpan("getWorkspaceTimeout");
        span.setTag("workspaceId", workspaceId);
        span.setTag("userId", user.id);

        try {
            const canChange = await this.maySetTimeout(user);

            const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({ span }));
            const runningInstance = await this.workspaceDb.trace({ span }).findRunningInstance(workspaceId);
            if (!runningInstance) {
                log.warn({ userId: user.id, workspaceId }, 'Can only get keep-alive for running workspaces');
                return { duration: "30m", canChange };
            }
            await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "get");

            const req = new DescribeWorkspaceRequest();
            req.setId(runningInstance.id);

            const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
            const desc = await client.describeWorkspace({ span }, req);
            const duration = desc.getStatus()!.getSpec()!.getTimeout() as WorkspaceTimeoutDuration;
            return { duration, canChange };
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }


    public async isPrebuildDone(pwsid: string): Promise<boolean> {
        // Allowed in the free version, because it is read only.
        // this.requireEELicense(Feature.FeaturePrebuild);

        const span = opentracing.globalTracer().startSpan("isPrebuildDone");
        span.setTag("pwsid", pwsid);
        const ctx: TraceContext = { span };
        try {
            const pws = await this.workspaceDb.trace(ctx).findPrebuildByID(pwsid);
            if (!pws) {
                // there is no prebuild - that's as good one being done
                return true;
            }

            return PrebuiltWorkspace.isDone(pws);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    /**
     * gitpod.io Extension point for implementing eligibility checks. Throws a ResponseError if not eligible.
     */
    protected async maySetTimeout(user: User): Promise<boolean> {
        return this.eligibilityService.maySetTimeout(user);
    }

    public async controlAdmission(id: string, level: "owner" | "everyone"): Promise<void> {
        this.requireEELicense(Feature.FeatureWorkspaceSharing);

        const user = this.checkAndBlockUser('controlAdmission');
        const span = opentracing.globalTracer().startSpan("controlAdmission");
        span.setTag("workspaceId", id);
        span.setTag("userId", user.id);
        span.setTag("level", level);

        const lvlmap = new Map<string, AdmissionLevel>();
        lvlmap.set("owner", AdmissionLevel.ADMIT_OWNER_ONLY);
        lvlmap.set("everyone", AdmissionLevel.ADMIT_EVERYONE);
        if (!lvlmap.has(level)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invalid admission level.");
        }

        try {
            const workspace = await this.internalGetWorkspace(id, this.workspaceDb.trace({ span }));
            await this.guardAccess({ kind: "workspace", subject: workspace }, "update");

            const instance = await this.workspaceDb.trace({ span }).findRunningInstance(id);
            if (instance) {
                await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace: workspace }, "update");

                const req = new ControlAdmissionRequest();
                req.setId(instance.id);
                req.setLevel(lvlmap.get(level)!);

                const client = await this.workspaceManagerClientProvider.get(instance.region);
                await client.controlAdmission({ span }, req);
            }

            await this.workspaceDb.trace({ span }).transaction(async db => {
                workspace.shareable = level === 'everyone';
                await db.store(workspace);
            });
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    async takeSnapshot(options: GitpodServer.TakeSnapshotOptions): Promise<string> {
        this.requireEELicense(Feature.FeatureSnapshot);

        const user = this.checkAndBlockUser("takeSnapshot");
        const { workspaceId, layoutData } = options;

        const span = opentracing.globalTracer().startSpan("takeSnapshot");
        span.setTag("workspaceId", workspaceId);
        span.setTag("userId", user.id);

        try {
            const workspace = await this.workspaceDb.trace({ span }).findById(workspaceId);
            if (!workspace || workspace.ownerId !== user.id) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
            }

            const instance = await this.workspaceDb.trace({ span }).findRunningInstance(workspaceId);
            if (!instance) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
            }

            await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace}, "get");
            await this.guardAccess({ kind: "snapshot", subject: undefined, workspaceOwnerID: workspace.ownerId, workspaceID: workspace.id }, "create");

            const client = await this.workspaceManagerClientProvider.get(instance.region);
            const request = new TakeSnapshotRequest();
            request.setId(instance.id);
            const resp = await client.takeSnapshot({ span }, request);

            const id = uuidv4()
            this.workspaceDb.trace({ span }).storeSnapshot({
                id,
                creationTime: new Date().toISOString(),
                bucketId: resp.getUrl(),
                originalWorkspaceId: workspaceId,
                layoutData
            });

            return id;
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish()
        }
    }

    async getSnapshots(workspaceId: string): Promise<string[]> {
        // Allowed in the free version, because it is read only.
        // this.requireEELicense(Feature.FeatureSnapshot);

        const user = this.checkAndBlockUser("getSnapshots");

        const span = opentracing.globalTracer().startSpan("getSnapshots");
        span.setTag("workspaceId", workspaceId);
        span.setTag("userId", user.id);

        try {
            const workspace = await this.workspaceDb.trace({ span }).findById(workspaceId);
            if (!workspace || workspace.ownerId !== user.id) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
            }

            const snapshots = await this.workspaceDb.trace({ span }).findSnapshotsByWorkspaceId(workspaceId);
            await Promise.all(snapshots.map(s => this.guardAccess({ kind: "snapshot", subject: s, workspaceOwnerID: workspace.ownerId }, "get")));

            return snapshots.map(s => s.id);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish()
        }
    }


    async adminGetUsers(req: AdminGetListRequest<User>): Promise<AdminGetListResult<User>> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetUsers", { req }, Permission.ADMIN_USERS);

        const span = opentracing.globalTracer().startSpan("adminGetUsers");
        try {
            const res = await this.userDB.findAllUsers(req.offset, req.limit, req.orderBy, req.orderDir === "asc" ? "ASC" : "DESC", req.searchTerm);
            res.rows = res.rows.map(this.censorUser);
            return res;
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }
    }

    async adminGetUser(id: string): Promise<User> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetUser", { id }, Permission.ADMIN_USERS);

        let result: User | undefined;
        const span = opentracing.globalTracer().startSpan("adminGetUser");
        try {
            result = await this.userDB.findUserById(id);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }

        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
        }
        return this.censorUser(result);
    }

    async adminBlockUser(req: AdminBlockUserRequest): Promise<User> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminBlockUser", { req }, Permission.ADMIN_USERS);

        const span = opentracing.globalTracer().startSpan("adminBlockUser");
        try {
            const target = await this.userDB.findUserById(req.id);
            if (!target) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
            }

            target.blocked = !!req.blocked;
            await this.userDB.storeUser(target);

            const workspaceDb = this.workspaceDb.trace({ span });
            const workspaces = await workspaceDb.findWorkspacesByUser(req.id);
            const isDefined = <T>(x: T | undefined): x is T => x !== undefined;
            (await Promise.all(workspaces.map((workspace) => workspaceDb.findRunningInstance(workspace.id))))
                .filter(isDefined)
                .forEach(instance => this.internalStopWorkspaceInstance({ span }, instance.id, instance.region, StopWorkspacePolicy.IMMEDIATELY));

            // For some reason, returning the result of `this.userDB.storeUser(target)` does not work. The response never arrives the caller.
            // Returning `target` instead (which should be equivalent).
            return this.censorUser(target);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }
    }

    async adminDeleteUser(id: string): Promise<void> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminDeleteUser", { id }, Permission.ADMIN_USERS);

        const span = opentracing.globalTracer().startSpan("adminDeleteUser");
        try {
            await this.userDeletionService.deleteUser(id);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }
    }

    async adminModifyRoleOrPermission(req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminModifyRoleOrPermission", { req }, Permission.ADMIN_USERS);

        const span = opentracing.globalTracer().startSpan("adminModifyRoleOrPermission");
        span.log(req);
        try {
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
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }
    }

    async adminModifyPermanentWorkspaceFeatureFlag(req: AdminModifyPermanentWorkspaceFeatureFlagRequest): Promise<User> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminModifyPermanentWorkspaceFeatureFlag", { req }, Permission.ADMIN_USERS);

        const span = opentracing.globalTracer().startSpan("adminModifyPermanentWorkspaceFeatureFlag");
        span.log(req);
        try {
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
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }
    }

    async adminGetWorkspaces(req: AdminGetWorkspacesRequest): Promise<AdminGetListResult<WorkspaceAndInstance>> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetWorkspaces", { req }, Permission.ADMIN_WORKSPACES);

        const span = opentracing.globalTracer().startSpan("adminGetWorkspaces");
        try {
            return await this.workspaceDb.trace({ span }).findAllWorkspaceAndInstances(req.offset, req.limit, req.orderBy, req.orderDir === "asc" ? "ASC" : "DESC", req.ownerId, req.searchTerm);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }
    }

    async adminGetWorkspace(id: string): Promise<WorkspaceAndInstance> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminGetWorkspace", { id }, Permission.ADMIN_WORKSPACES);

        let result: WorkspaceAndInstance | undefined;
        const span = opentracing.globalTracer().startSpan("adminGetWorkspace");
        try {
            result = await this.workspaceDb.trace({ span }).findWorkspaceAndInstance(id);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw new ResponseError(500, e.toString());
        } finally {
            span.finish();
        }

        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found")
        }
        return result;
    }

    async adminForceStopWorkspace(id: string): Promise<void> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminForceStopWorkspace", { id }, Permission.ADMIN_WORKSPACES);

        const span = opentracing.globalTracer().startSpan("adminForceStopWorkspace");
        const workspace = await this.workspaceDb.trace({ span }).findById(id);
        if (workspace) {
            await this.internalStopWorkspace({ span }, workspace, StopWorkspacePolicy.IMMEDIATELY, true);
        }
    }

    async adminRestoreSoftDeletedWorkspace(id: string): Promise<void> {
        this.requireEELicense(Feature.FeatureAdminDashboard);

        await this.guardAdminAccess("adminRestoreSoftDeletedWorkspace", { id }, Permission.ADMIN_WORKSPACES);

        const span = opentracing.globalTracer().startSpan("adminRestoreSoftDeletedWorkspace");
        await this.workspaceDb.trace({ span }).transaction(async db => {
            const ws = await db.findById(id);
            if (!ws) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, `No workspace with id '${id}' found.`);
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

    protected async findPrebuiltWorkspace(ctx: TraceContext, user: User, context: WorkspaceContext, mode: CreateWorkspaceMode): Promise<WorkspaceCreationResult | PrebuiltWorkspaceContext | undefined> {
        const span = TraceContext.startSpan("findPrebuiltWorkspace", ctx);
        span.setTag("mode", mode);
        span.setTag("userId", user.id);

        try {
            if (!(CommitContext.is(context) && context.repository.cloneUrl && context.revision)) {
                return;
            }

            const logCtx: LogContext = { userId: user.id };
            const cloneUrl = context.repository.cloneUrl;
            const prebuiltWorkspace = await this.workspaceDb.trace({ span }).findPrebuiltWorkspaceByCommit(cloneUrl, context.revision);
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

                const wsi = await this.workspaceDb.trace({}).findCurrentInstance(workspaceID);
                if (!wsi || wsi.stoppedTime !== undefined) {
                    if (prebuiltWorkspace.state === 'queued') {
                        if (Date.now() - Date.parse(prebuiltWorkspace.creationTime) > 1000 * 60) {
                            // queued for long than a minute? Let's retrigger
                            console.warn('Retriggering queued prebuild.', prebuiltWorkspace);
                            try {
                                await this.prebuildManager.retriggerPrebuild({ span }, user, workspaceID);
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
                        const finishedPrebuiltWorkspace = await this.pollDatabaseUntilPrebuildIsAvailable(prebuiltWorkspace.id, 20000);
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
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    async adminSetLicense(key: string): Promise<void> {
        await this.guardAdminAccess("adminGetWorkspaces", { key }, Permission.ADMIN_API);

        await this.licenseDB.store(uuidv4(), key);
        await this.licenseEvaluator.reloadLicense();
    }

    async getLicenseInfo(): Promise<GetLicenseInfoResult> {
        const user = this.checkAndBlockUser("getLicenseInfo");

        const { key } = await this.licenseKeySource.getKey();
        const { validUntil, seats } = this.licenseEvaluator.inspect();
        const { valid } = this.licenseEvaluator.validate();

        const isAdmin = this.authorizationService.hasPermission(user, Permission.ADMIN_API);

        return {
            isAdmin,
            licenseInfo: {
                key: isAdmin ? key : "REDACTED",
                seats,
                valid,
                validUntil
            }
        };
    }

    async licenseIncludesFeature(licenseFeature: LicenseFeature): Promise<boolean> {
        this.checkAndBlockUser("getLicenseInfo");

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
    public async getAccountStatement(options: GitpodServer.GetAccountStatementOptions): Promise<AccountStatement> {
        const user = this.checkUser("getAccountStatement");
        const now = options.date || new Date().toISOString();
        return this.accountStatementProvider.getAccountStatement(user.id, now);
    }

    public async getRemainingUsageHours(): Promise<number> {
        const span = opentracing.globalTracer().startSpan("getRemainingUsageHours");

        try {
            const user = this.checkUser("getRemainingUsageHours");
            const runningInstancesPromise = this.workspaceDb.trace({ span }).findRegularRunningInstances(user.id);
            return this.accountStatementProvider.getRemainingUsageHours(user.id, new Date().toISOString(), runningInstancesPromise);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    // (SaaS) – payment/billing
    async getAvailableCoupons(): Promise<PlanCoupon[]> {
        const user = this.checkUser('getAvailableCoupons');
        const couponIds = await this.couponComputer.getAvailableCouponIds(user);
        return this.getChargebeePlanCoupons(couponIds);
    }

    async getAppliedCoupons(): Promise<PlanCoupon[]> {
        const user = this.checkUser('getAppliedCoupons');
        const couponIds = await this.couponComputer.getAppliedCouponIds(user, new Date());
        return this.getChargebeePlanCoupons(couponIds);
    }

    public async getPrivateRepoTrialEndDate(): Promise<string | undefined> {
        const user = this.checkUser("getPrivateTrialInfo");

        const endDate = await this.eligibilityService.getPrivateRepoTrialEndDate(user);
        if (!endDate) {
            return undefined;
        } else {
            return endDate.toISOString();
        }
    }

    // chargebee
    async getChargebeeSiteId(): Promise<string> {
        this.checkUser('getChargebeeSiteId');
        if (!this.config.chargebeeProviderOptions) {
            log.error("config error: expected chargebeeProviderOptions but found none!");
            return "none";
        }
        return this.config.chargebeeProviderOptions.site;
    }

    public async isStudent(): Promise<boolean> {
        const user = this.checkUser("isStudent");
        return this.eligibilityService.isStudent(user);
    }

    async getShowPaymentUI(): Promise<boolean> {
        this.checkUser('getShowPaymentUI');
        return !!this.config.enablePayment;
    }

    async isChargebeeCustomer(): Promise<boolean> {
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

    protected async getChargebeePlanCoupons(couponIds: string[]) {
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

    async createPortalSession(): Promise<{}> {
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

    async checkout(planId: string, planQuantity?: number): Promise<{}> {
        const user = this.checkUser('checkout');
        const logContext = { userId: user.id };

        const span = opentracing.globalTracer().startSpan("checkout");
        span.setTag("user", user.id);

        // Throws an error if not the case
        await this.ensureIsEligibleForPlan(user, planId);

        try {
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
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
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

    async subscriptionUpgradeTo(subscriptionId: string, chargebeePlanId: string): Promise<void> {
        const user = this.checkUser('subscriptionUpgradeTo');
        await this.ensureIsEligibleForPlan(user, chargebeePlanId);
        await this.doUpdateUserPaidSubscription(user.id, subscriptionId, chargebeePlanId, false);
    }

    async subscriptionDowngradeTo(subscriptionId: string, chargebeePlanId: string): Promise<void> {
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

    async subscriptionCancel(subscriptionId: string): Promise<void> {
        const user = this.checkUser('subscriptionCancel');
        const chargebeeSubscriptionId = await this.doGetUserPaidSubscription(user.id, subscriptionId);
        await this.chargebeeService.cancelSubscription(chargebeeSubscriptionId, { userId: user.id }, { subscriptionId, chargebeeSubscriptionId });
    }

    async subscriptionCancelDowngrade(subscriptionId: string): Promise<void> {
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
    async tsGet(): Promise<TeamSubscription[]> {
        const user = this.checkUser('getTeamSubscriptions');
        return this.teamSubscriptionDB.findTeamSubscriptionsForUser(user.id, new Date().toISOString());
    }

    async tsGetSlots(): Promise<TeamSubscriptionSlotResolved[]> {
        const user = this.checkUser('tsGetSlots');
        return this.teamSubscriptionService.findTeamSubscriptionSlotsBy(user.id, new Date());
    }

    async tsGetUnassignedSlot(teamSubscriptionId: string): Promise<TeamSubscriptionSlot | undefined> {
        this.checkUser('tsGetUnassignedSlot');
        const slots = await this.teamSubscriptionService.findUnassignedSlots(teamSubscriptionId);
        return slots[0];
    }

    // Get the current number of "active" slots in a team subscription (count all "assigned" and "unassigned", but not "deactivated" or "cancelled").
    protected async tsGetActiveSlotQuantity(teamSubscriptionId: string): Promise<number> {
        const slots = await this.teamSubscriptionDB.findSlotsByTeamSubscriptionId(teamSubscriptionId);
        return slots.filter(TeamSubscriptionSlot.isActive).length;
    }

    async tsAddSlots(teamSubscriptionId: string, addQuantity: number): Promise<void> {
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

    async tsAssignSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string, identityStr: string | undefined): Promise<void> {
        const user = this.checkAndBlockUser('tsAssignSlot');
        // assigning a slot can be done by third users
        const ts = await this.internalGetTeamSubscription(teamSubscriptionId, identityStr ? user.id : undefined);
        const logCtx = { userId: user.id };

        try {
            // Verify assignee:
            //  - must be existing Gitpod user, uniquely identifiable per GitHub/GitLab/Bitbucket name
            //  - in case of Student Subscription: Must be a student
            const assigneeInfo: FindUserByIdentityStrResult = identityStr ? (await this.findAssignee(logCtx, identityStr)) : (await this.getAssigneeInfo(user));
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
    protected async getAssigneeInfo(user: User) {
        const authProviders = await this.getAuthProviders();
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

    async tsReassignSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string, newIdentityStr: string): Promise<void> {
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

    async tsDeactivateSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void> {
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

    async tsReactivateSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void> {
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

    async getGithubUpgradeUrls(): Promise<GithubUpgradeURL[]> {
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
    async adminGetAccountStatement(userId: string): Promise<AccountStatement> {
        const user = this.checkAndBlockUser("adminGetAccountStatement");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        return await this.accountService.getAccountStatement(userId, new Date().toISOString());
    }

    async adminSetProfessionalOpenSource(userId: string, shouldGetProfOSS: boolean): Promise<void> {
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

    async adminIsStudent(userId: string): Promise<boolean> {
        const user = this.checkAndBlockUser("adminIsStudent");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        return this.eligibilityService.isStudent(userId);
    }

    async adminAddStudentEmailDomain(userId: string, domain: string): Promise<void> {
        const user = this.checkAndBlockUser("adminAddStudentEmailDomain");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        const domainEntry: EduEmailDomain = {
            domain: domain.toLowerCase()
        };
        return this.eduDomainDb.storeDomainEntry(domainEntry);
    }

    async adminGrantExtraHours(userId: string, extraHours: number): Promise<void> {
        const user = this.checkAndBlockUser("adminGrantExtraHours");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        await this.subscriptionService.addCredit(userId, extraHours, new Date().toISOString());
    }

    // various
    async sendFeedback(feedback: string): Promise<string | undefined> {
        const user = this.checkUser("sendFeedback");
        const now = new Date().toISOString();
        const remainingUsageHours = await this.getRemainingUsageHours();
        const stillEnoughCredits = remainingUsageHours > Math.max(...Accounting.LOW_CREDIT_WARNINGS_IN_HOURS);
        log.info({ userId: user.id }, `Feedback: "${feedback}"`, { feedback, stillEnoughCredits });
        if (stillEnoughCredits) {
            return 'Thank you for your feedback.';
        }
        await this.subscriptionService.addCredit(user.id, 50, now);
        return 'Thank you for you feedback. We have added 50 Gitpod Hours to your account. Have fun!';
    }

    // Projects
    async getProviderRepositoriesForUser(params: { provider: string, hints?: object }): Promise<ProviderRepository[]> {
        const user = this.checkAndBlockUser("getProviderRepositoriesForUser");

        const repositories: ProviderRepository[] = [];
        if (params.provider === "github.com") {
            repositories.push(...(await this.githubAppSupport.getProviderRepositoriesForUser({ user, ...params })));
        } else if (params.provider === "gitlab.com") {
            repositories.push(...(await this.gitLabAppSupport.getProviderRepositoriesForUser({ user, ...params })));
        } else {
            log.info({ userId: user.id }, `Unsupported provider: "${params.provider}"`, { params });
        }
        const projects = await this.projectsService.getProjectsByCloneUrls(repositories.map(r => r.cloneUrl));

        const cloneUrlsInUse = new Set(projects.map(p => p.cloneUrl));
        repositories.forEach(r => { r.inUse = cloneUrlsInUse.has(r.cloneUrl) });

        await this.ensureTeamsEnabled();

        return repositories;
    }

    async triggerPrebuild(projectId: string, branchName: string | null): Promise<StartPrebuildResult> {
        const user = this.checkAndBlockUser("triggerPrebuild");

        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "update");

        const span = opentracing.globalTracer().startSpan("triggerPrebuild");
        span.setTag("userId", user.id);

        const branchDetails = (!!branchName
            ? await this.projectsService.getBranchDetails(user, project, branchName)
            : (await this.projectsService.getBranchDetails(user, project)).filter(b => b.isDefault));
        if (branchDetails.length !== 1) {
            log.debug({ userId: user.id }, 'Cannot find branch details.', { project, branchName });
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Could not find ${!branchName ? 'a default branch' : `branch '${branchName}'`} in repository ${project.cloneUrl}`);
        }
        const contextURL = branchDetails[0].url;

        const context = await this.contextParser.handle({ span }, user, contextURL) as CommitContext;

        const prebuild = await this.prebuildManager.startPrebuild({ span }, {
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

    public async createProject(params: CreateProjectParams): Promise<Project> {
        const project = await super.createProject(params);

        // update client registration for the logged in user
        this.disposables.push(this.messageBusIntegration.listenForPrebuildUpdates(
            (ctx: TraceContext, update: PrebuildWithStatus) => {
                this.client?.onPrebuildUpdate(update);
            },
            project.id
        ));
        return project;
    }

}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
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
    SetWorkspaceTimeoutResult,
    WorkspaceContext,
    WorkspaceCreationResult,
    PrebuiltWorkspaceContext,
    CommitContext,
    PrebuiltWorkspace,
    WorkspaceInstance,
    ProviderRepository,
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
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { LicenseValidationResult } from "@gitpod/gitpod-protocol/lib/license-protocol";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { GuardedCostCenter, ResourceAccessGuard, ResourceAccessOp } from "../../../src/auth/resource-access";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import { CostCenterJSON, ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import {
    CostCenter,
    CostCenter_BillingStrategy,
    ListUsageRequest_Ordering,
    UsageServiceClient,
    Usage_Kind,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { UserService } from "../../../src/user/user-service";
import { EduEmailDomainDB } from "@gitpod/gitpod-db/lib";
import { StripeService } from "../user/stripe-service";

import { GitHubAppSupport } from "../github/github-app-support";
import { GitLabAppSupport } from "../gitlab/gitlab-app-support";
import { Config } from "../../../src/config";
import { SnapshotService, WaitForSnapshotOptions } from "./snapshot-service";
import { ClientMetadata, traceClientMetadata } from "../../../src/websocket/websocket-connection-manager";
import { BitbucketAppSupport } from "../bitbucket/bitbucket-app-support";
import { URL } from "url";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { EntitlementService, MayStartWorkspaceResult } from "../../../src/billing/entitlement-service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { BillingModes } from "../billing/billing-mode";
import { UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import {
    BillingServiceClient,
    BillingServiceDefinition,
    StripeCustomer,
} from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { IncrementalPrebuildsService } from "../prebuilds/incremental-prebuilds-service";
import { ConfigProvider } from "../../../src/workspace/config-provider";
import { ClientError } from "nice-grpc-common";

@injectable()
export class GitpodServerEEImpl extends GitpodServerImpl {
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(IncrementalPrebuildsService) protected readonly incrementalPrebuildsService: IncrementalPrebuildsService;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;

    // per-user state
    @inject(EduEmailDomainDB) protected readonly eduDomainDb: EduEmailDomainDB;

    @inject(StripeService) protected readonly stripeService: StripeService;

    @inject(GitHubAppSupport) protected readonly githubAppSupport: GitHubAppSupport;
    @inject(GitLabAppSupport) protected readonly gitLabAppSupport: GitLabAppSupport;
    @inject(BitbucketAppSupport) protected readonly bitbucketAppSupport: BitbucketAppSupport;

    @inject(Config) protected readonly config: Config;

    @inject(SnapshotService) protected readonly snapshotService: SnapshotService;

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

        this.listenForPrebuildUpdates().catch((err) => log.error("error registering for prebuild updates", err));
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

    protected async mayStartWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string | undefined,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<void> {
        await super.mayStartWorkspace(ctx, user, organizationId, runningInstances);

        let result: MayStartWorkspaceResult = {};
        try {
            result = await this.entitlementService.mayStartWorkspace(
                user,
                organizationId,
                new Date(),
                runningInstances,
            );
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

    async validateLicense(ctx: TraceContext): Promise<LicenseValidationResult> {
        return { valid: true };
    }

    goDurationToHumanReadable(goDuration: string): string {
        const [, value, unit] = goDuration.match(/^(\d+)([mh])$/)!;
        let duration = parseInt(value);

        switch (unit) {
            case "m":
                duration *= 60;
                break;
            case "h":
                duration *= 60 * 60;
                break;
        }

        const hours = Math.floor(duration / 3600);
        duration %= 3600;
        const minutes = Math.floor(duration / 60);
        duration %= 60;

        let result = "";
        if (hours) {
            result += `${hours} hour${hours === 1 ? "" : "s"}`;
            if (minutes) {
                result += " and ";
            }
        }
        if (minutes) {
            result += `${minutes} minute${minutes === 1 ? "" : "s"}`;
        }

        return result;
    }

    public async setWorkspaceTimeout(
        ctx: TraceContext,
        workspaceId: string,
        duration: WorkspaceTimeoutDuration,
    ): Promise<SetWorkspaceTimeoutResult> {
        traceAPIParams(ctx, { workspaceId, duration });
        traceWI(ctx, { workspaceId });

        const user = this.checkUser("setWorkspaceTimeout");

        if (!(await this.entitlementService.maySetTimeout(user, new Date()))) {
            throw new ResponseError(ErrorCodes.PLAN_PROFESSIONAL_REQUIRED, "Plan upgrade is required");
        }

        let validatedDuration;
        try {
            validatedDuration = WorkspaceTimeoutDuration.validate(duration);
        } catch (err) {
            throw new ResponseError(ErrorCodes.INVALID_VALUE, "Invalid duration : " + err.message);
        }

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        const runningInstances = await this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
        const runningInstance = runningInstances.find((i) => i.workspaceId === workspaceId);
        if (!runningInstance) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Can only set keep-alive for running workspaces");
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "update");

        const client = await this.workspaceManagerClientProvider.get(runningInstance.region);

        const req = new SetTimeoutRequest();
        req.setId(runningInstance.id);
        req.setDuration(validatedDuration);
        await client.setTimeout(ctx, req);

        return {
            resetTimeoutOnWorkspaces: [workspace.id],
            humanReadableDuration: this.goDurationToHumanReadable(validatedDuration),
        };
    }

    public async getWorkspaceTimeout(ctx: TraceContext, workspaceId: string): Promise<GetWorkspaceTimeoutResult> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = this.checkUser("getWorkspaceTimeout");

        const canChange = await this.entitlementService.maySetTimeout(user, new Date());

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        const runningInstance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!runningInstance) {
            log.warn({ userId: user.id, workspaceId }, "Can only get keep-alive for running workspaces");
            const duration = WORKSPACE_TIMEOUT_DEFAULT_SHORT;
            return { duration, canChange, humanReadableDuration: this.goDurationToHumanReadable(duration) };
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "get");

        const req = new DescribeWorkspaceRequest();
        req.setId(runningInstance.id);

        const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
        const desc = await client.describeWorkspace(ctx, req);
        const duration = desc.getStatus()!.getSpec()!.getTimeout();

        return { duration, canChange, humanReadableDuration: this.goDurationToHumanReadable(duration) };
    }

    public async isPrebuildDone(ctx: TraceContext, pwsId: string): Promise<boolean> {
        traceAPIParams(ctx, { pwsId });

        const pws = await this.workspaceDb.trace(ctx).findPrebuildByID(pwsId);
        if (!pws) {
            // there is no prebuild - that's as good one being done
            return true;
        }

        return PrebuiltWorkspace.isDone(pws);
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

    async takeSnapshot(ctx: TraceContext, options: GitpodServer.TakeSnapshotOptions): Promise<string> {
        traceAPIParams(ctx, { options });
        const { workspaceId, dontWait } = options;
        traceWI(ctx, { workspaceId });

        const user = this.checkAndBlockUser("takeSnapshot");

        const workspace = await this.guardSnaphotAccess(ctx, user.id, workspaceId);

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!instance) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace }, "get");

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

        await this.guardAdminAccess("adminBlockUser", { req }, Permission.ADMIN_USERS);

        const targetUser = await this.userService.blockUser(req.id, req.blocked);

        const stoppedWorkspaces = await this.workspaceStarter.stopRunningWorkspacesForUser(
            ctx,
            req.id,
            "user blocked by admin",
            StopWorkspacePolicy.IMMEDIATELY,
        );

        log.info(`Stopped ${stoppedWorkspaces.length} workspaces in response to admin initiated block.`, {
            userId: targetUser.id,
            workspaceIds: stoppedWorkspaces.map((w) => w.id),
        });

        // For some reason, returning the result of `this.userDB.storeUser(target)` does not work. The response never arrives the caller.
        // Returning `target` instead (which should be equivalent).
        return this.censorUser(targetUser);
    }

    async adminVerifyUser(ctx: TraceContext, userId: string): Promise<User> {
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

        await this.guardAdminAccess("adminCreateBlockedRepository", { urlRegexp, blockUser }, Permission.ADMIN_USERS);

        return await this.blockedRepostoryDB.createBlockedRepository(urlRegexp, blockUser);
    }

    async adminDeleteBlockedRepository(ctx: TraceContext, id: number): Promise<void> {
        traceAPIParams(ctx, { id });

        await this.guardAdminAccess("adminDeleteBlockedRepository", { id }, Permission.ADMIN_USERS);

        await this.blockedRepostoryDB.deleteBlockedRepository(id);
    }

    async adminModifyRoleOrPermission(ctx: TraceContext, req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        traceAPIParams(ctx, { req });

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
        await this.guardAdminAccess("adminGetTeamMembers", { teamId }, Permission.ADMIN_WORKSPACES);

        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
        }
        const members = await this.teamDB.findMembersByTeam(team.id);
        return members;
    }

    async adminGetTeams(ctx: TraceContext, req: AdminGetListRequest<Team>): Promise<AdminGetListResult<Team>> {
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
        await this.guardAdminAccess("adminGetTeamById", { id }, Permission.ADMIN_WORKSPACES);
        return await this.teamDB.findTeamById(id);
    }

    async adminSetTeamMemberRole(
        ctx: TraceContext,
        teamId: string,
        userId: string,
        role: TeamMemberRole,
    ): Promise<void> {
        await this.guardAdminAccess("adminSetTeamMemberRole", { teamId, userId, role }, Permission.ADMIN_WORKSPACES);
        return this.teamDB.setTeamMemberRole(userId, teamId, role);
    }

    async adminGetWorkspaces(
        ctx: TraceContext,
        req: AdminGetWorkspacesRequest,
    ): Promise<AdminGetListResult<WorkspaceAndInstance>> {
        traceAPIParams(ctx, { req });

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

        await this.guardAdminAccess("adminGetWorkspace", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        const result = await this.workspaceDb.trace(ctx).findWorkspaceAndInstance(workspaceId);
        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }
        return result;
    }

    async adminForceStopWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });

        await this.guardAdminAccess("adminForceStopWorkspace", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (workspace) {
            await this.internalStopWorkspace(ctx, workspace, "stopped by admin", StopWorkspacePolicy.IMMEDIATELY, true);
        }
    }

    async adminRestoreSoftDeletedWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });

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
                prebuiltWorkspace = await this.workspaceDb
                    .trace(ctx)
                    .findPrebuiltWorkspaceByCommit(cloneUrl, commitSHAs);
                if (!prebuiltWorkspace && allowUsingPreviousPrebuilds) {
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
            } else if (prebuiltWorkspace.state === "queued") {
                // waiting for a prebuild that has not even started yet, doesn't make sense.
                // starting a workspace from git will be faster anyway
                return;
            } else if (prebuiltWorkspace.state === "building") {
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

    async subscribeToStripe(
        ctx: TraceContext,
        attributionId: string,
        setupIntentId: string,
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

            await this.billingService.createStripeSubscription({ attributionId, setupIntentId, usageLimit });

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

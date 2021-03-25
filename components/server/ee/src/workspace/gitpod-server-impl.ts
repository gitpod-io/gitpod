/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { GitpodServerImpl } from "../../../src/workspace/gitpod-server-impl";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { GitpodServer, GitpodClient, AdminGetListRequest, User, AdminGetListResult, Permission, AdminBlockUserRequest, AdminModifyRoleOrPermissionRequest, RoleOrPermission, AdminModifyPermanentWorkspaceFeatureFlagRequest, UserFeatureSettings, AdminGetWorkspacesRequest, WorkspaceAndInstance, GetWorkspaceTimeoutResult, WorkspaceTimeoutDuration, WorkspaceTimeoutValues, SetWorkspaceTimeoutResult, WorkspaceContext, CreateWorkspaceMode, WorkspaceCreationResult, PrebuiltWorkspaceContext, CommitContext, PrebuiltWorkspace, PermissionName } from "@gitpod/gitpod-protocol";
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
import { LicenseDB } from "@gitpod/gitpod-db/lib/license-db";

@injectable()
export class GitpodServerEEImpl<C extends GitpodClient, S extends GitpodServer> extends GitpodServerImpl<C, S> {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(LicenseDB) protected readonly licenseDB: LicenseDB;
    @inject(LicenseKeySource) protected readonly licenseKeySource: LicenseKeySource;

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
            await this.guardAccess({kind: "workspaceInstance", subject: runningInstance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: workspace.shareable || false}, "update");

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
            await this.guardAccess({kind: "workspaceInstance", subject: runningInstance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: workspace.shareable || false}, "get");

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
        return true;
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
            await this.guardAccess({kind: "workspace", subject: workspace}, "update");

            const instance = await this.workspaceDb.trace({ span }).findRunningInstance(id);
            if (instance) {
                await this.guardAccess({kind: "workspaceInstance", subject: instance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: workspace.shareable || false}, "update");

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

            await this.guardAccess({kind: "workspaceInstance", subject: instance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: workspace.shareable || false}, "get");
            await this.guardAccess({kind: "snapshot", subject: undefined, workspaceOwnerID: workspace.ownerId, workspaceID: workspace.id }, "create");

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
            await Promise.all(snapshots.map(s => this.guardAccess({kind: "snapshot", subject: s, workspaceOwnerID: workspace.ownerId}, "get")));

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

        await this.guardAdminAccess("adminGetUsers", {req}, Permission.ADMIN_USERS);
        
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

        await this.guardAdminAccess("adminGetUser", {id}, Permission.ADMIN_USERS);

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

        await this.guardAdminAccess("adminBlockUser", {req}, Permission.ADMIN_USERS);

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

        await this.guardAdminAccess("adminDeleteUser", {id}, Permission.ADMIN_USERS);

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

        await this.guardAdminAccess("adminModifyRoleOrPermission", {req}, Permission.ADMIN_USERS);

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

        await this.guardAdminAccess("adminModifyPermanentWorkspaceFeatureFlag", {req}, Permission.ADMIN_USERS);

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

        await this.guardAdminAccess("adminGetWorkspaces", {req}, Permission.ADMIN_WORKSPACES);

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

        await this.guardAdminAccess("adminGetWorkspace", {id}, Permission.ADMIN_WORKSPACES);

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

        await this.guardAdminAccess("adminForceStopWorkspace", {id}, Permission.ADMIN_WORKSPACES);

        const span = opentracing.globalTracer().startSpan("adminForceStopWorkspace");
        await this.internalStopWorkspace({ span }, id, undefined,  StopWorkspacePolicy.IMMEDIATELY);
    }

    protected async guardAdminAccess(method: string, params: any, requiredPermission: PermissionName) {
        const user = this.checkAndBlockUser(method);
        if (!this.authorizationService.hasPermission(user, requiredPermission)) {
            log.warn({userId: this.user?.id}, "unauthorised admin access", { authorised: false, method, params });
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }
        log.info({userId: this.user?.id}, "admin access", { authorised: true, method, params });
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
            const prebuiltWorkspace = await this.workspaceDb.trace({ span }).findPrebuiltWorkspaceByCommit(context.repository.cloneUrl, context.revision);
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
                }

                let result: WorkspaceCreationResult = {
                    runningWorkspacePrebuild: {
                        prebuildID: prebuiltWorkspace.id,
                        workspaceID: prebuiltWorkspace.buildWorkspaceId,
                        starting: 'queued',
                        sameCluster: false,
                    }
                };

                const wsi = await this.workspaceDb.trace({ span }).findCurrentInstance(prebuiltWorkspace.buildWorkspaceId);
                if (!wsi || wsi.stoppedTime !== undefined) {
                    if (prebuiltWorkspace.state === 'queued') {
                        if (Date.now() - Date.parse(prebuiltWorkspace.creationTime) > 1000 * 60) {
                            // queued for long than a minute? Let's retrigger
                            console.warn('Retriggering queued prebuild.', prebuiltWorkspace);
                            try {
                                await this.prebuildManager.retriggerPrebuild({ span }, user, prebuiltWorkspace.buildWorkspaceId);
                            } catch (err) {
                                console.error(err);
                            }
                        }
                        return result;
                    }

                    return;
                }

                const inSameCluster = wsi.region === this.env.installationShortname;
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
        await this.guardAdminAccess("adminGetWorkspaces", {key}, Permission.ADMIN_API);

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

}

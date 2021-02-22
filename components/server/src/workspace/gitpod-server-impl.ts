/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { BlobServiceClient } from "@gitpod/content-service/lib/blobs_grpc_pb";
import { DownloadUrlRequest, DownloadUrlResponse, UploadUrlRequest, UploadUrlResponse } from '@gitpod/content-service/lib/blobs_pb';
import { AppInstallationDB } from '@gitpod/gitpod-db/lib/app-installation-db';
import { DBWithTracing, TracedWorkspaceDB } from '@gitpod/gitpod-db/lib/traced-db';
import { DBGitpodToken } from '@gitpod/gitpod-db/lib/typeorm/entity/db-gitpod-token';
import { DBUser } from '@gitpod/gitpod-db/lib/typeorm/entity/db-user';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { UserMessageViewsDB } from '@gitpod/gitpod-db/lib/user-message-views-db';
import { UserStorageResourcesDB } from '@gitpod/gitpod-db/lib/user-storage-resources-db';
import { WorkspaceDB } from '@gitpod/gitpod-db/lib/workspace-db';
import { AuthProviderEntry, AuthProviderInfo, Branding, CommitContext, Configuration, CreateWorkspaceMode, DisposableCollection, GetWorkspaceTimeoutResult, GitpodClient, GitpodServer, GitpodToken, GitpodTokenType, InstallPluginsParams, PermissionName, PortVisibility, PrebuiltWorkspace, PrebuiltWorkspaceContext, PreparePluginUploadParams, ResolvedPlugins, ResolvePluginsParams, SetWorkspaceTimeoutResult, StartPrebuildContext, StartWorkspaceResult, Terms, Token, UninstallPluginParams, User, UserEnvVar, UserEnvVarValue, UserInfo, UserMessage, WhitelistedRepository, Workspace, WorkspaceContext, WorkspaceCreationResult, WorkspaceImageBuild, WorkspaceInfo, WorkspaceInstance, WorkspaceInstancePort, WorkspaceInstanceUser, WorkspaceTimeoutDuration } from '@gitpod/gitpod-protocol';
import { AdminBlockUserRequest, AdminGetListRequest, AdminGetListResult, AdminGetWorkspacesRequest, AdminModifyPermanentWorkspaceFeatureFlagRequest, AdminModifyRoleOrPermissionRequest, WorkspaceAndInstance } from '@gitpod/gitpod-protocol/lib/admin-protocol';
import { GetLicenseInfoResult, LicenseFeature, LicenseValidationResult } from '@gitpod/gitpod-protocol/lib/license-protocol';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { Cancelable } from '@gitpod/gitpod-protocol/lib/util/cancelable';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { ImageBuilderClientProvider, LogsRequest } from '@gitpod/image-builder/lib';
import { WorkspaceManagerClientProvider } from '@gitpod/ws-manager/lib/client-provider';
import { ControlPortRequest, DescribeWorkspaceRequest, MarkActiveRequest, PortSpec, PortVisibility as ProtoPortVisibility, StopWorkspacePolicy, StopWorkspaceRequest } from '@gitpod/ws-manager/lib/core_pb';
import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import * as opentracing from 'opentracing';
import { URL } from 'url';
import * as uuidv4 from 'uuid/v4';
import { Disposable, ResponseError } from 'vscode-jsonrpc';
import { AuthProviderService } from '../auth/auth-provider-service';
import { HostContextProvider } from '../auth/host-context-provider';
import { GuardedResource, ResourceAccessGuard, ResourceAccessOp } from '../auth/resource-access';
import { Env } from '../env';
import { NotFoundError, UnauthorizedError } from '../errors';
import { parseRepoUrl } from '../repohost/repo-url';
import { TermsProvider } from '../terms/terms-provider';
import { TheiaPluginService } from '../theia-plugin/theia-plugin-service';
import { AuthorizationService } from '../user/authorization-service';
import { TokenProvider } from '../user/token-provider';
import { UserDeletionService } from '../user/user-deletion-service';
import { UserService } from '../user/user-service';
import { IClientDataPrometheusAdapter } from './client-data-prometheus-adapter';
import { ContextParser } from './context-parser-service';
import { MessageBusIntegration } from './messagebus-integration';
import { WorkspaceDeletionService } from './workspace-deletion-service';
import { WorkspaceFactory } from './workspace-factory';
import { WorkspaceStarter } from './workspace-starter';


@injectable()
export class GitpodServerImpl<Client extends GitpodClient, Server extends GitpodServer> implements GitpodServer, Disposable {

    @inject(Env) protected readonly env: Env;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(WorkspaceFactory) protected readonly workspaceFactory: WorkspaceFactory;
    @inject(WorkspaceDeletionService) protected readonly workspaceDeletionService: WorkspaceDeletionService;
    @inject(MessageBusIntegration) protected readonly messageBusIntegration: MessageBusIntegration;
    @inject(ContextParser) protected contextParser: ContextParser;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(WorkspaceManagerClientProvider) protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;
    @inject(ImageBuilderClientProvider) protected imageBuilderClientProvider: ImageBuilderClientProvider;

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(UserService) protected readonly userService: UserService;
    @inject(UserMessageViewsDB) protected readonly userMessageViewsDB: UserMessageViewsDB;
    @inject(UserStorageResourcesDB) protected readonly userStorageResourcesDB: UserStorageResourcesDB;
    @inject(UserDeletionService) protected readonly userDeletionService: UserDeletionService;
    @inject(AuthorizationService) protected readonly authorizationService: AuthorizationService;

    @inject(AppInstallationDB) protected readonly appInstallationDB: AppInstallationDB;

    @inject(IClientDataPrometheusAdapter) protected readonly clientDataPrometheusAdapter: IClientDataPrometheusAdapter;

    @inject(TheiaPluginService) protected readonly pluginService: TheiaPluginService;

    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;

    @inject(TermsProvider) protected readonly termsProvider: TermsProvider;

    @inject(BlobServiceClient) protected readonly blobServiceClient: BlobServiceClient;

    /** Id the uniquely identifies this server instance */
    public readonly uuid: string = uuidv4();
    protected client: Client | undefined;
    protected user?: User;
    protected clientRegion: string | undefined;
    protected readonly disposables = new DisposableCollection();
    protected headlessLogRegistry = new Map<string, boolean>();
    protected resourceAccessGuard: ResourceAccessGuard;

    dispose(): void {
        this.disposables.dispose();
    }

    initialize(client: Client | undefined, clientRegion: string | undefined, user: User, accessGuard: ResourceAccessGuard): void {
        if (client) {
            this.disposables.push(Disposable.create(() => this.client = undefined));
        }
        this.client = client;
        this.user = user;
        this.clientRegion = clientRegion;
        this.resourceAccessGuard = accessGuard;
        this.listenForWorkspaceInstanceUpdates();
    }

    protected listenForWorkspaceInstanceUpdates(): void {
        if (!this.user || !this.client) {
            return;
        }
        log.debug({ userId: this.user.id }, `clientRegion: ${this.clientRegion}`);
        log.info({ userId: this.user.id }, 'initializeClient');

        const withTrace = (ctx: TraceContext, cb: () => void) => {
            // if we don't have a parent span, don't create a trace here as those <trace-without-root-spans> are not useful.
            if (!ctx || !ctx.span || !ctx.span.context()) {
                cb();
                return;
            }

            const span = TraceContext.startSpan("forwardInstanceUpdateToClient", ctx);
            try {
                cb();
            } catch (e) {
                TraceContext.logError({ span }, e);
                throw e;
            } finally {
                span.finish();
            }
        }

        // TODO(cw): the instance update is not subject to resource access guards, hence provides instance info
        //           to clients who might not otherwise have access to that information.
        this.disposables.push(this.messageBusIntegration.listenForWorkspaceInstanceUpdates(
            this.user.id,
            (ctx: TraceContext, instance: WorkspaceInstance) => withTrace(ctx, () => this.client?.onInstanceUpdate(this.censorInstance(instance)))
        ));
    }

    setClient(client: Client | undefined): void {
        throw new Error('Unsupported operation. Use initialize.')
    }

    protected async guardAccess(resource: GuardedResource, op: ResourceAccessOp) {
        if (!(await this.resourceAccessGuard.canAccess(resource, op))) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `operation not permitted: missing ${op} permission on ${resource.kind}`);
        }
    }

    /**
     * We don't need to/want to publish all internal details we maintain about a workspace instance.
     * This function removes instance details we do not want to share with the dashboard/Theia/potential attackers.
     * 
     * @param wsi the workspace instance shape we want to censor
     */
    protected censorInstance<T extends WorkspaceInstance | undefined>(wsi: T): T {
        if (!wsi) {
            return wsi;
        }

        const res = { ...wsi! };

        // owner token will set as cookie in the future
        delete (res.status.ownerToken);
        // is an operational internal detail
        delete (res.status.nodeName);
        // configuration contains feature flags and theia version.
        // we might want to share that in the future, but for the time being there's no need
        delete (res.configuration);
        // internal operation detail
        delete (res.workspaceImage);

        return res;
    }

    protected checkUser(methodName?: string, logPayload?: {}): User {
        if (this.setupRequired) {
            throw new ResponseError(ErrorCodes.SETUP_REQUIRED, 'Setup required.');
        }
        if (!this.user) {
            throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, 'User is not authenticated. Please login.');
        }
        if (this.user.markedDeleted === true) {
            throw new ResponseError(ErrorCodes.USER_DELETED, 'User has been deleted.');
        }
        const userContext: LogContext = { userId: this.user.id };
        if (methodName) {
            if (logPayload) {
                log.info(userContext, methodName, logPayload);
            } else {
                log.info(userContext, methodName);
            }
        }
        return this.user;
    }

    protected checkAndBlockUser(methodName?: string, logPayload?: {}): User {
        const user = this.checkUser(methodName, logPayload);
        if (user.blocked) {
            const userContext: LogContext = { userId: user.id };
            if (logPayload) {
                log.info(userContext, `${methodName || 'checkAndBlockUser'}: blocked`, logPayload);
            } else {
                log.info(userContext, `${methodName || 'checkAndBlockUser'}: blocked`);
            }
            throw new ResponseError(ErrorCodes.USER_BLOCKED, "You've been blocked.");
        }
        return user;
    }


    public async getLoggedInUser(): Promise<User> {
        await this.doUpdateUser();
        return this.checkUser("getLoggedInUser");
    }

    protected setupRequired: boolean = false;
    protected async doUpdateUser(): Promise<void> {
        const hasAnyStaticProviders = this.hostContextProvider.getAll().some(hc => hc.authProvider.config.builtin === true);
        if (!hasAnyStaticProviders) {
            const userCount = await this.userDB.getUserCount();
            this.setupRequired = userCount === 0;
        }

        if (this.user) {
            const updatedUser = await this.userDB.findUserById(this.user.id);
            if (updatedUser) {
                this.user = updatedUser;
            }
        }
    }
    protected termsAccepted: boolean | undefined;
    protected async checkTermsAcceptance() {
        if (!this.termsAccepted) {
            if (this.user) {
                this.termsAccepted = await this.userService.checkTermsAccepted(this.user);
            }
        }
        if (!this.termsAccepted) {
            throw new ResponseError(ErrorCodes.USER_TERMS_ACCEPTANCE_REQUIRED, "You need to accept the terms.");
        }
    }

    public async updateLoggedInUser(partialUser: Partial<User>): Promise<User> {
        const user = this.checkUser('updateLoggedInUser');
        await this.guardAccess({ kind: "user", subject: user }, "update");

        const allowedFields: (keyof User)[] = ['avatarUrl', 'fullName', 'allowsMarketingCommunication', 'additionalData'];
        for (const p of allowedFields) {
            if (p in partialUser) {
                (user[p] as any) = partialUser[p];
            }
        }
        await this.userDB.updateUserPartial(user);
        return user;
    }

    public async getClientRegion(): Promise<string | undefined> {
        this.checkUser("getClientRegion");
        return this.clientRegion;
    }

    public async getAuthProviders(): Promise<AuthProviderInfo[]> {
        const hostContexts = this.hostContextProvider.getAll();
        const authProviders = hostContexts.map(hc => hc.authProvider.info);

        // if no user session is available, compute public information only
        if (!this.user) {
            const toPublic = (info: AuthProviderInfo) => <AuthProviderInfo>{
                authProviderId: info.authProviderId,
                authProviderType: info.authProviderType,
                disallowLogin: info.disallowLogin,
                host: info.host,
                icon: info.icon,
                description: info.description
            }
            const result = authProviders.map(toPublic);
            return result;
        }

        // otherwise show all the details
        const result: AuthProviderInfo[] = [];
        for (const info of authProviders) {
            const identity = this.user.identities.find(i => i.authProviderId === info.authProviderId);
            if (identity) {
                result.push({ ...info, isReadonly: identity.readonly });
                continue;
            }
            result.push(info);
        }
        return result;
    }

    public async getBranding(): Promise<Branding> {
        return this.env.brandingConfig;
    }

    public async getConfiguration(): Promise<Configuration> {
        return {
            garbageCollectionStartDate: this.env.garbageCollectionStartDate,
            daysBeforeGarbageCollection: this.env.daysBeforeGarbageCollection
        }
    }

    public async getToken(query: GitpodServer.GetTokenSearchOptions): Promise<Token | undefined> {
        await this.doUpdateUser();
        const user = this.checkUser("getToken");
        const logCtx = { userId: user.id, host: query.host };

        const { host } = query;
        try {
            const token = await this.tokenProvider.getTokenForHost(user, host);
            await this.guardAccess({ kind: "token", subject: token, tokenOwnerID: user.id }, "get");

            return token;
        } catch (error) {
            log.error(logCtx, "failed to find token: ", error);
            return undefined
        }
    }

    public async getPortAuthenticationToken(workspaceId: string): Promise<Token> {
        const user = this.checkAndBlockUser("getPortAuthenticationToken", { workspaceId });
        const span = opentracing.globalTracer().startSpan("getPortAuthenticationToken");
        span.setTag("workspaceId", workspaceId);

        const workspace = await this.workspaceDb.trace({ span }).findById(workspaceId);
        await this.guardAccess({ kind: "workspace", subject: workspace! }, "get");

        try {
            const token = await this.tokenProvider.getFreshPortAuthenticationToken(user, workspaceId);
            await this.guardAccess({ kind: "token", subject: token, tokenOwnerID: user.id }, "create");

            return token;
        } finally {
            span.finish();
        }
    }

    public async deleteAccount(): Promise<void> {
        const user = this.checkUser("deleteAccount");
        await this.guardAccess({ kind: "user", subject: user! }, "delete");

        await this.userDeletionService.deleteUser(user.id);
    }

    public async getWorkspace(id: string): Promise<WorkspaceInfo> {
        const user = this.checkUser('getWorkspace');
        const span = opentracing.globalTracer().startSpan("getWorkspace");
        span.setTag("workspaceId", id);
        span.setTag("userId", user.id);

        try {
            const workspace = await this.internalGetWorkspace(id, this.workspaceDb.trace({ span }));
            await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

            const latestInstance = await this.workspaceDb.trace({}).findCurrentInstance(id);
            if (!!latestInstance) {
                await this.guardAccess({ 
                    kind: "workspaceInstance", 
                    subject: latestInstance, 
                    workspaceOwnerID: workspace.ownerId,
                    workspaceIsShared: workspace.shareable || false,
                }, "get");
            }

            return {
                workspace,
                latestInstance: this.censorInstance(latestInstance)
            };
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async startWorkspace(workspaceId: string, options: { forceDefaultImage: boolean }): Promise<StartWorkspaceResult> {
        const span = opentracing.globalTracer().startSpan("startWorkspace");
        span.setTag("workspaceId", workspaceId);

        try {
            const user = this.checkAndBlockUser();
            await this.checkTermsAcceptance();

            log.info({ userId: user.id, workspaceId }, 'startWorkspace');

            const mayStartPromise = this.mayStartWorkspace({ span }, user, this.workspaceDb.trace({ span }).findRegularRunningInstances(user.id));
            const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({ span }));
            await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

            const runningInstance = await this.workspaceDb.trace({ span }).findRunningInstance(workspace.id);
            if (runningInstance) {
                // We already have a running workspace.
                // Note: ownership doesn't matter here as this is basically a noop. It's not StartWorkspace's concern
                //       to guard workspace access - just to prevent non-owners from starting workspaces.

                await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: workspace.shareable || false }, "get");
                return {
                    instanceID: runningInstance.id,
                    workspaceURL: runningInstance.ideUrl,
                };
            }

            if (!!workspace.softDeleted) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "Workspace not found!");
            }

            // no matter if the workspace is shared or not, you cannot create a new instance
            await this.guardAccess({ kind: "workspaceInstance", subject: undefined, workspaceOwnerID: workspace.ownerId, workspaceIsShared: false }, "create");

            if (workspace.type !== "regular") {
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Cannot (re-)start irregular workspace.");
            }

            if (workspace.deleted) {
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Cannot (re-)start a deleted workspace.");
            }
            const envVars = this.userDB.getEnvVars(user.id);

            await mayStartPromise;

            // at this point we're about to actually start a new workspace
            return await this.workspaceStarter.startWorkspace({ span }, workspace, user, await envVars, {
                forceDefaultImage: !!options.forceDefaultImage
            });
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async stopWorkspace(workspaceId: string): Promise<void> {
        const user = this.checkUser('stopWorkspace');
        const logCtx = { userId: user.id, workspaceId };

        const span = opentracing.globalTracer().startSpan("stopWorkspace");
        span.setTag("workspaceId", workspaceId);

        try {
            log.info(logCtx, 'stopWorkspace');

            const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({ span }));
            await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

            this.internalStopWorkspace({ span }, workspaceId, workspace.ownerId).catch(err => {
                log.error(logCtx, "stopWorkspace error: ", err);
            });
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected async internalStopWorkspace(ctx: TraceContext, workspaceId: string, ownerId?: string, policy?: StopWorkspacePolicy): Promise<void> {
        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!instance) {
            // there's no instance running - we're done
            return;
        }

        if (!ownerId) {
            const ws = await this.workspaceDb.trace(ctx).findById(workspaceId);
            if (!ws) {
                return;
            }
            ownerId = ws.ownerId;
        }

        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspaceOwnerID: ownerId, workspaceIsShared: false }, "update");
        await this.internalStopWorkspaceInstance(ctx, instance.id, instance.region, policy);
    }

    protected async internalStopWorkspaceInstance(ctx: TraceContext, instanceId: string, instanceRegion: string, policy?: StopWorkspacePolicy): Promise<void> {
        const req = new StopWorkspaceRequest();
        req.setId(instanceId);
        req.setPolicy(policy || StopWorkspacePolicy.NORMALLY);

        const client = await this.workspaceManagerClientProvider.get(instanceRegion);
        await client.stopWorkspace(ctx, req);
    }

    public async updateWorkspaceUserPin(id: string, action: "pin" | "unpin" | "toggle"): Promise<void> {
        const user = this.checkAndBlockUser('updateWorkspacePin');
        const span = opentracing.globalTracer().startSpan("updateWorkspacePin");
        span.setTag("workspaceId", id);
        span.setTag("userId", user.id);
        span.setTag("action", action);

        try {
            await this.workspaceDb.trace({ span }).transaction(async db => {
                const ws = await this.internalGetWorkspace(id, db);
                await this.guardAccess({ kind: "workspace", subject: ws }, "update");

                switch (action) {
                    case "pin":
                        ws.pinned = true;
                        break
                    case "unpin":
                        ws.pinned = false;
                        break
                    case "toggle":
                        ws.pinned = !ws.pinned;
                        break
                }

                await db.store(ws);
            });
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async deleteWorkspace(id: string): Promise<void> {
        const user = this.checkAndBlockUser('deleteWorkspace');
        const span = opentracing.globalTracer().startSpan("deleteWorkspace");
        span.setTag("workspaceId", id);
        span.setTag("userId", user.id);

        try {
            const ws = await this.internalGetWorkspace(id, this.workspaceDb.trace({}));
            await this.guardAccess({ kind: "workspace", subject: ws }, "delete");

            // for good measure, try and stop running instances
            await this.internalStopWorkspace({ span }, id, ws.ownerId);

            // actually delete the workspace
            await this.workspaceDeletionService.softDeleteWorkspace({ span }, ws, "user");
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async controlAdmission(id: string, level: "owner" | "everyone"): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Workspace sharing support is implemented in Gitpod's Enterprise Edition`)
    }

    public async setWorkspaceDescription(id: string, description: string): Promise<void> {
        const user = this.checkAndBlockUser('setWorkspaceDescription');
        const span = opentracing.globalTracer().startSpan("setWorkspaceDescription");
        span.setTag("workspaceId", id);
        span.setTag("userId", user.id);

        try {
            const workspace = await this.internalGetWorkspace(id, this.workspaceDb.trace({ span }));

            await this.guardAccess({ kind: "workspace", subject: workspace }, "update");
            await this.workspaceDb.trace({ span }).updatePartial(id, { description });
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async getWorkspaces(options: GitpodServer.GetWorkspacesOptions): Promise<WorkspaceInfo[]> {
        const user = this.checkUser("getWorkspaces");

        const res = await this.workspaceDb.trace({}).find({
            limit: 20,
            ...options,
            userId: user.id,
            includeHeadless: false,
        });
        await Promise.all(res.map(ws => this.guardAccess({ kind: "workspace", subject: ws.workspace }, "get")));
        await Promise.all(res.map(ws => this.guardAccess({ kind: "workspaceInstance", subject: ws.latestInstance, workspaceOwnerID: ws.workspace.ownerId, workspaceIsShared: ws.workspace.shareable || false }, "get")));
        return res;
    }

    public async isWorkspaceOwner(workspaceId: string): Promise<boolean> {
        const user = this.checkUser();
        log.info({ userId: user.id, workspaceId }, 'isWorkspaceOwner');

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({}));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        return user.id == workspace.ownerId;
    }

    public async sendHeartBeat(options: GitpodServer.SendHeartBeatOptions): Promise<void> {
        const user = this.checkAndBlockUser("sendHeartBeat");

        const { instanceId } = options;
        log.info({ userId: user.id, instanceId }, 'sendHeartBeat');

        const span = opentracing.globalTracer().startSpan("sendHeartBeat");
        try {
            span.setTag("workspaceId", instanceId);
            span.setTag("userId", user.id);

            const wsi = await this.workspaceDb.trace({ span }).findInstanceById(instanceId);
            if (!wsi) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "workspace does not exist");
            }

            const ws = await this.workspaceDb.trace({ span }).findById(wsi.workspaceId);
            if (!ws) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "workspace does not exist");
            }
            await this.guardAccess({ kind: "workspaceInstance", subject: wsi, workspaceOwnerID: ws.ownerId, workspaceIsShared: ws.shareable || false }, "update");

            const wasClosed = !!(options && options.wasClosed);
            await this.workspaceDb.trace({ span }).updateLastHeartbeat(instanceId, user.id, new Date(), wasClosed);

            const req = new MarkActiveRequest();
            req.setId(instanceId);
            req.setClosed(wasClosed);

            const client = await this.workspaceManagerClientProvider.get(wsi.region);
            await client.markActive({ span }, req);

            if (options && options.roundTripTime && Number.isFinite(options.roundTripTime)) {
                this.clientDataPrometheusAdapter.storeWorkspaceRoundTripTimeSample(new Date(), user, instanceId, options.roundTripTime);
            }
        } catch (e) {
            TraceContext.logError({ span }, e);
            if (e.message && typeof (e.message) === 'string' && (e.message as String).endsWith("does not exist")) {
                // This is an old tab with open workspace: drop silently
                return;
            } else {
                throw e;
            }
        } finally {
            span.finish();
        }
    }

    async getWorkspaceOwner(workspaceId: string): Promise<UserInfo | undefined> {
        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({}));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        const owner = await this.userDB.findUserById(workspace.ownerId);
        if (!owner) {
            return undefined;
        }

        await this.guardAccess({ kind: "user", subject: owner }, "get");
        return { name: owner.name };
    }

    public async getWorkspaceUsers(workspaceId: string): Promise<WorkspaceInstanceUser[]> {
        const user = this.checkUser();
        log.info({ userId: user.id, workspaceId }, 'getWorkspaceUsers');

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({}));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        // Note: there's no need to try and guard the users below, they're not complete users but just enough to
        //       to support the workspace sharing. The access guard above is enough.
        return await this.workspaceDb.trace({}).getWorkspaceUsers(workspaceId, this.env.workspaceUserTimeout);
    }

    protected async internalGetWorkspace(id: string, db: WorkspaceDB): Promise<Workspace> {
        const ws = await db.findById(id);
        if (!ws) {
            throw new Error(`No workspace with id '${id}' found.`);
        }
        await this.guardAccess({ kind: "workspace", subject: ws }, "get");
        return ws;
    }

    private async findRunningInstancesForContext(ctx: TraceContext, contextPromise: Promise<WorkspaceContext>, contextUrl: string, runningInstancesPromise: Promise<WorkspaceInstance[]>): Promise<WorkspaceInfo[]> {
        const span = TraceContext.startSpan("findRunningInstancesForContext", ctx);
        try {
            const runningInstances = (await runningInstancesPromise).filter(instance => instance.status.phase !== 'stopping');
            const runningInfos = await Promise.all(runningInstances.map(async workspaceInstance => {
                const workspace = await this.workspaceDb.trace({ span }).findById(workspaceInstance.workspaceId);
                if (!workspace) {
                    return;
                }

                const result: WorkspaceInfo = {
                    workspace,
                    latestInstance: workspaceInstance
                };
                return result;
            }));

            let context: WorkspaceContext;
            try {
                context = await contextPromise;
            } catch {
                return [];
            }
            const sameContext = (ws: WorkspaceInfo) => {
                return ws.workspace.contextURL === contextUrl &&
                    CommitContext.is(ws.workspace.context) &&
                    CommitContext.is(context) &&
                    ws.workspace.context.revision === context.revision
            }
            return runningInfos
                .filter(info => info && info.workspace.type === "regular" && sameContext(info))
                .map(info => info!);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async isPrebuildDone(pwsid: string): Promise<boolean> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, "Prebuilds are implemented in Gitpod's enterprise edition")
    }

    public async createWorkspace(options: GitpodServer.CreateWorkspaceOptions): Promise<WorkspaceCreationResult> {
        const contextUrl = options.contextUrl;
        const mode = options.mode || CreateWorkspaceMode.Default;
        let normalizedContextUrl: string = "";
        let logContext: LogContext = {};

        const span = opentracing.globalTracer().startSpan("createWorkspace");
        span.setTag("contextUrl", contextUrl);
        span.setTag("mode", mode);
        const ctx: TraceContext = { span };
        try {
            const user = this.checkAndBlockUser("createWorkspace", { mode });
            await this.checkTermsAcceptance();
            span.setTag("userId", user.id);

            const envVars = this.userDB.getEnvVars(user.id);
            logContext = { userId: user.id };

            // Credit check runs in parallel with the other operations up until we start consuming resources.
            // Make sure to await for the creditCheck promise in the right places.
            const runningInstancesPromise = this.workspaceDb.trace({ span }).findRegularRunningInstances(user.id);
            normalizedContextUrl = this.contextParser.normalizeContextURL(contextUrl);
            let runningForContextPromise: Promise<WorkspaceInfo[]> = Promise.resolve([]);
            const contextPromise = this.contextParser.handle(ctx, user, normalizedContextUrl);
            if (mode === CreateWorkspaceMode.SelectIfRunning) {
                runningForContextPromise = this.findRunningInstancesForContext(ctx, contextPromise, normalizedContextUrl, runningInstancesPromise);
            }

            // make sure we've checked that the user has enough credit before consuming any resources.
            // Be sure to check this before prebuilds and create workspace, too!
            let context = await contextPromise;
            await Promise.all([
                this.mayStartWorkspace({ span }, user, runningInstancesPromise),
                this.mayOpenContext(user, context)
            ]);

            // if this is an explicit prebuild, check if the user wants to install an app.
            if (StartPrebuildContext.is(context) && CommitContext.is(context.actual) && context.actual.repository.cloneUrl) {
                const cloneUrl = context.actual.repository.cloneUrl;
                const host = new URL(cloneUrl).hostname;
                const hostContext = this.hostContextProvider.get(host);
                const services = hostContext && hostContext.services;
                if (!hostContext || !services) {
                    console.error('Unknown host: ' + host);
                } else {
                    if (await services.repositoryService.canInstallAutomatedPrebuilds(user, cloneUrl)) {
                        console.log('Installing automated prebuilds for ' + cloneUrl);
                        services.repositoryService.installAutomatedPrebuilds(user, cloneUrl);
                    }
                }
            }

            if (mode === CreateWorkspaceMode.SelectIfRunning && context.forceCreateNewWorkspace !== true) {
                const runningForContext = await runningForContextPromise;
                if (runningForContext.length > 0) {
                    return { existingWorkspaces: runningForContext }
                }
            }

            const prebuiltWorkspace = await this.findPrebuiltWorkspace({ span }, user, context, mode);
            if (WorkspaceCreationResult.is(prebuiltWorkspace)) {
                span.log({ prebuild: "running" });
                return prebuiltWorkspace as WorkspaceCreationResult;
            }
            if (WorkspaceContext.is(prebuiltWorkspace)) {
                span.log({ prebuild: "available" });
                context = prebuiltWorkspace;
            }

            const workspace = await this.workspaceFactory.createForContext({ span }, user, context, normalizedContextUrl);
            try {
                await this.guardAccess({ kind: "workspace", subject: workspace }, "create");
            } catch (err) {
                await this.workspaceDb.trace({ span }).hardDeleteWorkspace(workspace.id);
                throw err;
            }

            logContext.workspaceId = workspace.id;
            span.setTag("workspaceId", workspace.id);
            const startWorkspaceResult = await this.workspaceStarter.startWorkspace({ span }, workspace, user, await envVars);
            span.log({ "event": "startWorkspaceComplete", ...startWorkspaceResult });

            return {
                workspaceURL: startWorkspaceResult.workspaceURL,
                createdWorkspaceId: workspace.id
            };
        } catch (error) {
            if (NotFoundError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "Repository not found.", error.data);
            }
            if (UnauthorizedError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }

            TraceContext.logError({ span }, error);
            const errorCode = this.parseErrorCode(error);
            if (errorCode) {
                // specific errors will be handled in create-workspace.tsx
                throw error;
            }
            log.error(logContext, error);
            throw new ResponseError(ErrorCodes.CONTEXT_PARSE_ERROR, (error && error.message) ? error.message
                : `Cannot create workspace for URL: ${normalizedContextUrl}`);
        } finally {
            span.finish();
        }
    }

    /**
     * This is an explicit extension point for allowing downstream versions of Gitpod to selectively restrict access.
     * @returns true if the user is allowed to access the repository
     */
    protected async mayStartWorkspaceOnRepo(): Promise<boolean> {
        return true;
    }


    protected parseErrorCode(error: any) {
        const errorCode = error && error.code;
        if (errorCode) {
            try {
                const code = parseInt(errorCode);
                if (!isNaN(code)) {
                    return code;
                }
            } catch { }
        }
        return undefined;
    }

    protected async findPrebuiltWorkspace(ctx: TraceContext, user: User, context: WorkspaceContext, mode: CreateWorkspaceMode): Promise<WorkspaceCreationResult | PrebuiltWorkspaceContext | undefined> {
        // prebuilds are an EE feature
        return undefined;
    }

    protected async pollDatabaseUntilPrebuildIsAvailable(prebuildID: string, timeoutMS: number): Promise<PrebuiltWorkspace | undefined> {
        const pollPrebuildAvailable = new Cancelable(async cancel => {
            const prebuild = await this.workspaceDb.trace({}).findPrebuildByID(prebuildID);
            if (prebuild && PrebuiltWorkspace.isAvailable(prebuild)) {
                return prebuild;
            }
            return;
        });

        const result = await Promise.race([
            pollPrebuildAvailable.run(),
            new Promise<undefined>((resolve, reject) => setTimeout(() => resolve(undefined), timeoutMS))
        ]);
        pollPrebuildAvailable.cancel();

        return result;
    }

    /**
     * Extension point for implementing eligibility checks. Throws a ResponseError if not eligible.
     * @param ctx 
     * @param user 
     * @param runningInstances 
     */
    protected async mayStartWorkspace(ctx: TraceContext, user: User, runningInstances: Promise<WorkspaceInstance[]>): Promise<void> {
    }

    /**
     * Extension point for implementing eligibility checks. Throws a ResponseError if not eligible.
     * @param user 
     * @param context 
     */
    protected async mayOpenContext(user: User, context: WorkspaceContext): Promise<void> {
    }

    public async mayAccessPrivateRepo(): Promise<boolean> {
        // TODO remove after IO-split
        return true;
    }

    public async getUserMessages(options: GitpodServer.GetUserMessagesOptions): Promise<UserMessage[]> {
        // TODO remove after IO-split
        return [];
    }

    public async updateUserMessages(options: GitpodServer.UpdateUserMessagesOptions): Promise<void> {
        const userId = this.checkUser("updateUserMessages").id;
        const messageIds = options.messageIds;
        await this.userMessageViewsDB.markAsViewed(userId, messageIds);
    }

    public async getFeaturedRepositories(): Promise<WhitelistedRepository[]> {
        const user = this.checkUser("getFeaturedRepositories");
        const repositories = await this.workspaceDb.trace({}).getFeaturedRepositories();
        if (repositories.length === 0) return [];

        return (await Promise.all(repositories
            .filter(repo => repo.url != undefined)
            .map(async whitelistedRepo => {
                const repoUrl = parseRepoUrl(whitelistedRepo.url!);
                if (!repoUrl) return undefined;

                const { host, owner, repo } = repoUrl;
                const hostContext = this.hostContextProvider.get(host);
                if (!hostContext || !hostContext.services) {
                    return undefined;
                }
                const repoProvider = hostContext.services.repositoryProvider;
                try {
                    const repository = await repoProvider.getRepo(user, owner, repo);
                    return {
                        url: repository.webUrl,
                        name: repository.name,
                        description: whitelistedRepo.description || repository.description,
                        avatar: repository.avatarUrl,
                    }
                } catch {
                    // this happens quite often if only GitLab is enabled
                }
            }
            ))).filter(e => e !== undefined) as WhitelistedRepository[];
    }

    public async setWorkspaceTimeout(workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Custom workspace timeout is implemented in Gitpod's Enterprise Edition`);
    }

    public async getWorkspaceTimeout(workspaceId: string): Promise<GetWorkspaceTimeoutResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Custom workspace timeout is implemented in Gitpod's Enterprise Edition`);
    }

    public async getOpenPorts(workspaceId: string): Promise<WorkspaceInstancePort[]> {
        const user = this.checkUser("getOpenPorts");
        const span = opentracing.globalTracer().startSpan("getOpenPorts");
        span.setTag("workspaceId", workspaceId);
        span.setTag("userId", user.id);

        try {
            const instance = await this.workspaceDb.trace({ span }).findRunningInstance(workspaceId);
            const workspace = await this.workspaceDb.trace({ span }).findById(workspaceId);
            if (!instance || !workspace) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
            }

            await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: workspace.shareable || false }, "get");

            const req = new DescribeWorkspaceRequest();
            req.setId(instance.id);
            const client = await this.workspaceManagerClientProvider.get(instance.region);
            const desc = await client.describeWorkspace({ span }, req);

            if (!desc.hasStatus()) {
                throw new Error("describeWorkspace returned no status");
            }

            const status = desc.getStatus()!;
            const ports = status.getSpec()!.getExposedPortsList().map(p => <WorkspaceInstancePort>{
                port: p.getPort(),
                targetPort: p.getTarget(),
                url: p.getUrl(),
                visibility: this.portVisibilityFromProto(p.getVisibility())
            });

            return ports;
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async openPort(workspaceId: string, port: WorkspaceInstancePort): Promise<WorkspaceInstancePort | undefined> {
        const user = this.checkAndBlockUser("openPort");
        const span = opentracing.globalTracer().startSpan("openPort");
        span.setTag("workspaceId", workspaceId);
        span.setTag("userId", user.id);
        span.setTag("port", port);

        try {
            const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({ span }));
            const runningInstance = await this.workspaceDb.trace({ span }).findRunningInstance(workspaceId);
            if (!runningInstance) {
                log.warn({ userId: user.id, workspaceId }, 'Cannot open port for workspace with no running instance', { port });
                return;
            }
            await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: false }, "update");

            const req = new ControlPortRequest();
            req.setId(runningInstance.id);
            const spec = new PortSpec();
            spec.setPort(port.port);
            if (!!port.targetPort) {
                spec.setTarget(port.targetPort);
            } else {
                spec.setTarget(port.port);
            }
            spec.setVisibility(this.portVisibilityToProto(port.visibility))
            req.setSpec(spec);
            req.setExpose(true);

            const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
            await client.controlPort({ span }, req);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected portVisibilityFromProto(visibility: ProtoPortVisibility): PortVisibility {
        switch (visibility) {
            default:    // the default in the protobuf def is: private
            case ProtoPortVisibility.PORT_VISIBILITY_PRIVATE:
                return 'private';
            case ProtoPortVisibility.PORT_VISIBILITY_PUBLIC:
                return 'public';
        }
    }

    protected portVisibilityToProto(visibility: PortVisibility | undefined): ProtoPortVisibility {
        switch (visibility) {
            case 'private':
                return ProtoPortVisibility.PORT_VISIBILITY_PRIVATE;
            default:    // the default for requests is: public
            case 'public':
                return ProtoPortVisibility.PORT_VISIBILITY_PUBLIC;
        }
    }

    public async closePort(workspaceId: string, port: number) {
        const user = this.checkAndBlockUser("closePort");
        const span = opentracing.globalTracer().startSpan("closePort");
        span.setTag("workspaceId", workspaceId);
        span.setTag("userId", user.id);
        span.setTag("port", port);

        try {
            const { workspace, instance } = await this.internGetCurrentWorkspaceInstance(user.id, workspaceId);
            if (!instance || instance.status.phase !== 'running') {
                log.warn({ userId: user.id, workspaceId }, 'Cannot close a port for a workspace which has no running instance', { port });
                return;
            }
            await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: false }, "update");

            const req = new ControlPortRequest();
            req.setId(instance.id);
            const spec = new PortSpec();
            spec.setPort(port);
            req.setSpec(spec);
            req.setExpose(false);

            const client = await this.workspaceManagerClientProvider.get(instance.region);
            await client.controlPort({ span }, req);
        } catch (e) {
            TraceContext.logError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    async watchWorkspaceImageBuildLogs(workspaceId: string): Promise<void> {
        const user = this.checkAndBlockUser("watchWorkspaceImageBuildLogs");
        const span = opentracing.globalTracer().startSpan("watchWorkspaceImageBuildLogs");
        const context: LogContext = { userId: user.id, workspaceId };
        log.info(context, 'watchWorkspaceImageBuildLogs', { workspaceId });

        const { instance, workspace } = await this.internGetCurrentWorkspaceInstance(user.id, workspaceId);
        if (!this.client) {
            return;
        }
        if (!instance) {
            log.warn(`No running instance for workspaceId ${workspaceId}.`);
            return;
        }
        if (!workspace.imageNameResolved) {
            log.warn(`No imageNameResolved set for workspaceId ${workspaceId}, cannot watch logs.`);
            return;
        }

        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspaceOwnerID: workspace.ownerId, workspaceIsShared: workspace.shareable || false }, "get");
        if (!this.client) {
            return;
        }

        try {
            const imgbuilder = this.imageBuilderClientProvider.getDefault();
            const req = new LogsRequest();
            req.setCensored(true);
            req.setBuildRef(workspace.imageNameResolved);

            let lineCount = 0;
            imgbuilder.logs({ span }, req, data => {
                if (!this.client) {
                    return 'stop';
                }
                data = data.replace("\n", WorkspaceImageBuild.LogLine.DELIMITER);
                lineCount += data.split(WorkspaceImageBuild.LogLine.DELIMITER_REGEX).length;

                this.client.onWorkspaceImageBuildLogs(undefined as any, {
                    text: data,
                    isDiff: true,
                    upToLine: lineCount
                })
                return 'continue';
            });
        } catch (err) {
            log.warn(`Cannot watch logs for workspaceId ${workspaceId}:`, err)
        }
    }

    async watchHeadlessWorkspaceLogs(workspaceId: string): Promise<void> {
        const user = this.checkAndBlockUser();
        const context: LogContext = { userId: user.id, workspaceId };
        log.info(context, 'watchHeadlessWorkspaceLogs', { workspaceId });

        const { instance, workspace } = await this.internGetCurrentWorkspaceInstance(user.id, workspaceId)
        if (!this.client) {
            return;
        }
        if (!instance) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
        }
        if (workspace.type !== "prebuild") {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `Cannot watch logs for ${workspaceId}.`)
        }

        /* TODO: who is allowed to watch these logs? At the moment everyone can watch anything. That's not good.
         *    #security #permissions #concept-needed
         */

        if (this.headlessLogRegistry.has(workspaceId)) {
            // we're already registered
            return;
        }

        try {
            log.info({ workspaceId, userId: user.id }, "Registering headless log listener")
            this.headlessLogRegistry.set(workspaceId, true);

            this.disposables.push(this.messageBusIntegration.listenForHeadlessWorkspaceLogs(workspaceId, (ctx, evt) => this.client?.onHeadlessWorkspaceLogs(evt)));
        } catch (err) {
            log.warn(`Cannot watch logs for workspaceId ${workspaceId}:`, err);
            this.headlessLogRegistry.delete(workspaceId);
        }
    }

    protected async internGetCurrentWorkspaceInstance(userId: string, workspaceId: string): Promise<{ workspace: Workspace, instance: WorkspaceInstance | undefined }> {
        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({}));

        const instance = await this.workspaceDb.trace({}).findRunningInstance(workspaceId);
        return { instance, workspace };
    }

    async getUserStorageResource(options: GitpodServer.GetUserStorageResourceOptions): Promise<string> {
        const userId = this.checkUser("getUserStorageResource", { uri: options.uri }).id;
        const uri = options.uri;

        await this.guardAccess({ kind: "userStorage", uri, userID: userId }, "get");

        return await this.userStorageResourcesDB.get(userId, uri);
    }

    async updateUserStorageResource(options: GitpodServer.UpdateUserStorageResourceOptions): Promise<void> {
        const userId = this.checkAndBlockUser("updateUserStorageResource", { uri: options.uri }).id;
        const uri = options.uri;
        const content = options.content;

        await this.guardAccess({ kind: "userStorage", uri, userID: userId }, "update");

        await this.userStorageResourcesDB.update(userId, uri, content);
    }


    async sendFeedback(feedback: string): Promise<string | undefined> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, 'Sending feedback is not implemented');
    }

    async registerGithubApp(installationId: string): Promise<void> {
        const user = this.checkAndBlockUser();

        if (!this.env.githubAppEnabled) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, 'User is not authenticated. Please login.');
        }

        await this.appInstallationDB.recordNewInstallation('github', 'user', installationId, user.id);
    }

    async takeSnapshot(options: GitpodServer.TakeSnapshotOptions): Promise<string> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Snapshot support is implemented in Gitpod's Enterprise Edition`);
    }

    async getSnapshots(workspaceId: string): Promise<string[]> {
        // this is an EE feature. Throwing an exception here would break the dashboard though.
        return [];
    }

    /**
     * stores/updates layout information for the given workspace
     */
    async storeLayout(workspaceId: string, layoutData: string): Promise<void> {
        const user = this.checkAndBlockUser("storeLayout");
        const workspace = await this.workspaceDb.trace({}).findById(workspaceId);
        if (!workspace || workspace.ownerId !== user.id) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
        }

        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");

        await this.workspaceDb.trace({}).storeLayoutData({
            workspaceId,
            lastUpdatedTime: new Date().toISOString(),
            layoutData
        });
    }

    /**
     * retrieves layout information for the given workspace
     */
    async getLayout(workspaceId: string): Promise<string | undefined> {
        this.checkUser("storeLayout");

        const workspace = await this.workspaceDb.trace({}).findById(workspaceId);
        if (!workspace) {
            return;
        }
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        const layoutData = await this.workspaceDb.trace({}).findLayoutDataByWorkspaceId(workspaceId);
        if (!layoutData) {
            return;
        }
        return layoutData.layoutData;
    }

    async getEnvVars(): Promise<UserEnvVarValue[]> {
        // Note: this operation is per-user only, hence needs no resource guard

        const user = this.checkUser("getEnvVars");
        return (await this.userDB.getEnvVars(user.id)).map(v => {
            return {
                id: v.id,
                name: v.name,
                value: v.value,
                repositoryPattern: v.repositoryPattern,
            }
        });
    }

    async setEnvVar(variable: UserEnvVarValue): Promise<void> {
        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkUser("setEnvVar");

        variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);
        const existingVars = (await this.userDB.getEnvVars(user.id)).filter(v => !v.deleted);
        if (!variable.id) {
            // this is a new variable - make sure the user does not have too many (don't DOS our database using gp env)
            const varCount = existingVars.length;
            if (varCount > this.env.maxUserEnvvarCount) {
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `cannot have more than ${this.env.maxUserEnvvarCount} environment variables`)
            }
        }

        const existingVar = existingVars.find(v => v.name == variable.name && v.repositoryPattern == variable.repositoryPattern);
        if (!!existingVar) {
            // overwrite existing variable rather than introduce a duplicate
            variable.id = existingVar.id;
        }

        const envvar: UserEnvVar = {
            ...variable,
            id: variable.id || uuidv4(),
            userId: user.id,
        };
        await this.userDB.setEnvVar(envvar);
    }

    async deleteEnvVar(variable: UserEnvVarValue): Promise<void> {
        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkUser("deleteEnvVar");

        if (!variable.id) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Missing ID field")
        }

        const envvar: UserEnvVar = {
            ...variable,
            id: variable.id!,
            userId: user.id,
        };
        await this.userDB.deleteEnvVar(envvar);
    }

    public async getContentBlobUploadUrl(name: string): Promise<string> {
        const user = this.checkAndBlockUser("getContentBlobUploadUrl");
        await this.guardAccess({ kind: "contentBlob", name: name, userID: user.id }, "create");

        const uploadUrlRequest = new UploadUrlRequest();
        uploadUrlRequest.setName(name);
        uploadUrlRequest.setOwnerId(user.id);

        const uploadUrlPromise = new Promise<UploadUrlResponse>((resolve, reject) => {
            this.blobServiceClient.uploadUrl(uploadUrlRequest, (err: any, resp: UploadUrlResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        try {
            const resp = (await uploadUrlPromise).toObject();
            return resp.url;
        } catch (err) {
            log.error("Error getting content blob upload url: ", err);
            throw err;
        }
    }

    public async getContentBlobDownloadUrl(name: string): Promise<string> {
        const user = this.checkAndBlockUser("getContentBlobDownloadUrl");
        await this.guardAccess({ kind: "contentBlob", name: name, userID: user.id }, "get");

        const downloadUrlRequest = new DownloadUrlRequest();
        downloadUrlRequest.setName(name);
        downloadUrlRequest.setOwnerId(user.id);

        const downloadUrlPromise = new Promise<DownloadUrlResponse>((resolve, reject) => {
            this.blobServiceClient.downloadUrl(downloadUrlRequest, (err: any, resp: DownloadUrlResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        try {
            const resp = (await downloadUrlPromise).toObject();
            return resp.url;
        } catch (err) {
            log.error("Error getting content blob download url: ", err);
            throw err;
        }
    }

    public async getGitpodTokens(): Promise<GitpodToken[]> {
        const user = this.checkAndBlockUser("getGitpodTokens");
        const res = (await this.userDB.findAllGitpodTokensOfUser(user.id)).filter(v => !v.deleted);
        await Promise.all(res.map(tkn => this.guardAccess({ kind: "gitpodToken", subject: tkn }, "get")));
        return res;
    }

    public async generateNewGitpodToken(options: { name?: string, type: GitpodTokenType, scopes?: [] }): Promise<string> {
        const user = this.checkAndBlockUser("generateNewGitpodToken");
        this.checkAndBlockUser
        const token = crypto.randomBytes(30).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest("hex");
        const dbToken: DBGitpodToken = {
            tokenHash,
            name: options.name,
            type: options.type,
            user: user as DBUser,
            scopes: options.scopes || [],
            created: new Date().toISOString(),
        };
        await this.guardAccess({ kind: "gitpodToken", subject: dbToken }, "create");

        await this.userDB.storeGitpodToken(dbToken)
        return token;
    }

    public async deleteGitpodToken(tokenHash: string): Promise<void> {
        const user = this.checkAndBlockUser("deleteGitpodToken");
        const existingTokens = await this.getGitpodTokens(); // all tokens for logged in user
        const tkn = existingTokens.find(token => token.tokenHash === tokenHash);
        if (!tkn) {
            throw new Error(`User ${user.id} tries to delete a token ${tokenHash} that does not exist.`);
        }
        await this.guardAccess({ kind: "gitpodToken", subject: tkn }, "delete");
        return this.userDB.deleteGitpodToken(tokenHash);
    }

    public async hasPermission(permission: PermissionName): Promise<boolean> {
        const user = this.checkUser("hasPermission");
        return this.authorizationService.hasPermission(user, permission);
    }

    preparePluginUpload(params: PreparePluginUploadParams): Promise<string> {
        const user = this.checkUser("preparePluginUpload");
        return this.pluginService.preparePluginUpload(params, user.id);
    }

    async resolvePlugins(workspaceId: string, params: ResolvePluginsParams): Promise<ResolvedPlugins> {
        this.checkUser("resolvePlugins")

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace({}));
        const result = await this.pluginService.resolvePlugins(workspace.ownerId, params);
        return result.resolved;
    };

    installUserPlugins(params: InstallPluginsParams): Promise<boolean> {
        const userId = this.checkUser("installUserPlugins").id;
        return this.pluginService.installUserPlugins(userId, params);
    }

    uninstallUserPlugin(params: UninstallPluginParams): Promise<boolean> {
        const userId = this.checkUser("uninstallUserPlugin").id;
        return this.pluginService.uninstallUserPlugin(userId, params);
    }

    async adminGetUsers(req: AdminGetListRequest<User>): Promise<AdminGetListResult<User>> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetUser(id: string): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminBlockUser(req: AdminBlockUserRequest): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminDeleteUser(_id: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminModifyRoleOrPermission(req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminModifyPermanentWorkspaceFeatureFlag(req: AdminModifyPermanentWorkspaceFeatureFlagRequest): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetWorkspaces(req: AdminGetWorkspacesRequest): Promise<AdminGetListResult<WorkspaceAndInstance>> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetWorkspace(id: string): Promise<WorkspaceAndInstance> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminForceStopWorkspace(id: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminSetLicense(key: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async getLicenseInfo(): Promise<GetLicenseInfoResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Licensing is implemented in Gitpod's Enterprise Edition`);
    }

    async licenseIncludesFeature(feature: LicenseFeature): Promise<boolean> {
        return false;
    }

    protected censorUser(user: User): User {
        const res = { ...user };
        delete (res.additionalData);
        res.identities = res.identities.map(i => {
            delete (i.tokens);

            // The user field is not in the Identity shape, but actually exists on DBIdentity.
            // Trying to push this object out via JSON RPC will fail because of the cyclic nature
            // of this field.
            delete ((i as any).user);
            return i;
        });
        return res;
    }

    async validateLicense(): Promise<LicenseValidationResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Licensing is implemented in Gitpod's Enterprise Edition`);
    }

    async getOwnAuthProviders(): Promise<AuthProviderEntry[]> {
        const redacted = (entry: AuthProviderEntry) => ({
            ...entry,
            oauth: {
                ...entry.oauth,
                clientSecret: "redacted"
            }
        });
        let userId: string;
        try {
            userId = this.checkAndBlockUser("getOwnAuthProviders").id;
        } catch (error) {
            userId = this.acceptNotAuthenticatedForInitialSetup(error);
        }
        const ownAuthProviders = await this.authProviderService.getAuthProvidersOfUser(userId);
        return ownAuthProviders.map(redacted);
    }
    protected acceptNotAuthenticatedForInitialSetup(error: any) {
        if (error && error instanceof ResponseError) {
            if (error.code === ErrorCodes.NOT_AUTHENTICATED ||
                error.code === ErrorCodes.SETUP_REQUIRED) {
                return "no-user";
            }
        }
        throw error;
    }

    // from https://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address/106223#106223
    // adapted to allow for hostnames
    //   from [foo.bar] pumped up to [foo.(foo.)bar]
    // and also for a trailing path segments
    //   for example [foo.bar/gitlab]
    protected validHostNameRegexp = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])(\/([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9]))?$/;

    async updateOwnAuthProvider({ entry }: GitpodServer.UpdateOwnAuthProviderParams): Promise<void> {
        let userId: string;
        try {
            userId = this.checkAndBlockUser("updateOwnAuthProvider").id;
        } catch (error) {
            userId = this.acceptNotAuthenticatedForInitialSetup(error);
        }

        if (userId !== entry.ownerId) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, 'Not allowed to modify this resource.');
        }

        const safeProvider = this.redactUpdateOwnAuthProviderParams({ entry });
        try {
            if ("host" in safeProvider) {
                // on creating we're are checking for already existing runtime providers

                const host = safeProvider.host && safeProvider.host.toLowerCase();

                if (!this.validHostNameRegexp.exec(host)) {
                    log.debug(`Invalid auth provider host.`, { entry, safeProvider });
                    throw new Error("Invalid host name.");
                }

                const hostContext = this.hostContextProvider.get(host);
                if (hostContext) {
                    const builtInExists = hostContext.authProvider.config.ownerId === undefined;
                    log.debug(`Attempt to override existing auth provider.`, { entry, safeProvider, builtInExists });
                    throw new Error("Provider for host has already been registered.");
                }
            }
            await this.authProviderService.updateAuthProvider(safeProvider);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to update the provider.";
            throw new ResponseError(ErrorCodes.CONFLICT, message);
        }
    }
    protected redactUpdateOwnAuthProviderParams({ entry }: GitpodServer.UpdateOwnAuthProviderParams) {
        const safeEntry = "id" in entry ? <AuthProviderEntry.UpdateEntry>{
            id: entry.id,
            clientId: entry.clientId,
            clientSecret: entry.clientSecret,
            ownerId: entry.ownerId,
        } : <AuthProviderEntry.NewEntry>{
            host: entry.host,
            type: entry.type,
            ownerId: entry.ownerId,
        }
        return safeEntry;
    }

    async deleteOwnAuthProvider(params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void> {
        let userId: string;
        try {
            userId = this.checkAndBlockUser("deleteOwnAuthProvider").id;
        } catch (error) {
            userId = this.acceptNotAuthenticatedForInitialSetup(error);
        }

        const ownProviders = await this.authProviderService.getAuthProvidersOfUser(userId);
        const authProvider = ownProviders.find(p => p.id === params.id);
        if (!authProvider) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, 'User resource not found.');
        }
        try {
            await this.authProviderService.deleteAuthProvider(authProvider);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to delete the provider.";
            throw new ResponseError(ErrorCodes.CONFLICT, message);
        }
    }

    async getTerms(): Promise<Terms> {
        // Terms are publicly available, thus no user check here.

        return this.termsProvider.getCurrent();
    }

}

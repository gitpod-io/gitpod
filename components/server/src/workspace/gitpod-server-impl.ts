/**
* Copyright (c) 2020 Gitpod GmbH. All rights reserved.
* Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DownloadUrlRequest, DownloadUrlResponse, UploadUrlRequest, UploadUrlResponse } from '@gitpod/content-service/lib/blobs_pb';
import { AppInstallationDB, UserDB, UserMessageViewsDB, WorkspaceDB, DBWithTracing, TracedWorkspaceDB, DBGitpodToken, DBUser, UserStorageResourcesDB, TeamDB, InstallationAdminDB, ProjectDB } from '@gitpod/gitpod-db/lib';
import { AuthProviderEntry, AuthProviderInfo, CommitContext, Configuration, CreateWorkspaceMode, DisposableCollection, GetWorkspaceTimeoutResult, GitpodClient as GitpodApiClient, GitpodServer, GitpodToken, GitpodTokenType, InstallPluginsParams, PermissionName, PortVisibility, PrebuiltWorkspace, PrebuiltWorkspaceContext, PreparePluginUploadParams, ResolvedPlugins, ResolvePluginsParams, SetWorkspaceTimeoutResult, StartPrebuildContext, StartWorkspaceResult, Terms, Token, UninstallPluginParams, User, UserEnvVar, UserEnvVarValue, UserInfo, WhitelistedRepository, Workspace, WorkspaceContext, WorkspaceCreationResult, WorkspaceImageBuild, WorkspaceInfo, WorkspaceInstance, WorkspaceInstancePort, WorkspaceInstanceUser, WorkspaceTimeoutDuration, GuessGitTokenScopesParams, GuessedGitTokenScopes, Team, TeamMemberInfo, TeamMembershipInvite, CreateProjectParams, Project, ProviderRepository, TeamMemberRole, WithDefaultConfig, FindPrebuildsParams, PrebuildWithStatus, StartPrebuildResult, ClientHeaderFields, Permission } from '@gitpod/gitpod-protocol';
import { AccountStatement } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { AdminBlockUserRequest, AdminGetListRequest, AdminGetListResult, AdminGetWorkspacesRequest, AdminModifyPermanentWorkspaceFeatureFlagRequest, AdminModifyRoleOrPermissionRequest, WorkspaceAndInstance } from '@gitpod/gitpod-protocol/lib/admin-protocol';
import { GetLicenseInfoResult, LicenseFeature, LicenseValidationResult } from '@gitpod/gitpod-protocol/lib/license-protocol';
import { GitpodFileParser } from '@gitpod/gitpod-protocol/lib/gitpod-file-parser';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { GithubUpgradeURL, PlanCoupon } from "@gitpod/gitpod-protocol/lib/payment-protocol";
import { TeamSubscription, TeamSubscriptionSlot, TeamSubscriptionSlotResolved } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { Cancelable } from '@gitpod/gitpod-protocol/lib/util/cancelable';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { InterfaceWithTraceContext, TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { IdentifyMessage, PageMessage, RemoteIdentifyMessage, RemotePageMessage, RemoteTrackMessage, TrackMessage } from '@gitpod/gitpod-protocol/lib/analytics';
import { ImageBuilderClientProvider, LogsRequest } from '@gitpod/image-builder/lib';
import { WorkspaceManagerClientProvider } from '@gitpod/ws-manager/lib/client-provider';
import { ControlPortRequest, DescribeWorkspaceRequest, MarkActiveRequest, PortSpec, PortVisibility as ProtoPortVisibility, StopWorkspacePolicy, StopWorkspaceRequest } from '@gitpod/ws-manager/lib/core_pb';
import * as crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Disposable, ResponseError } from 'vscode-jsonrpc';
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { AuthProviderService } from '../auth/auth-provider-service';
import { HostContextProvider } from '../auth/host-context-provider';
import { GuardedResource, ResourceAccessGuard, ResourceAccessOp } from '../auth/resource-access';
import { Config } from '../config';
import { NotFoundError, UnauthorizedError } from '../errors';
import { RepoURL } from '../repohost/repo-url';
import { TermsProvider } from '../terms/terms-provider';
import { TheiaPluginService } from '../theia-plugin/theia-plugin-service';
import { AuthorizationService } from '../user/authorization-service';
import { TokenProvider } from '../user/token-provider';
import { UserDeletionService } from '../user/user-deletion-service';
import { UserService } from '../user/user-service';
import { IClientDataPrometheusAdapter } from './client-data-prometheus-adapter';
import { ContextParser } from './context-parser-service';
import { GitTokenScopeGuesser } from "./git-token-scope-guesser";
import { WorkspaceDeletionService } from './workspace-deletion-service';
import { WorkspaceFactory } from './workspace-factory';
import { WorkspaceStarter } from './workspace-starter';
import { HeadlessLogUrls } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { HeadlessLogService } from "./headless-log-service";
import { InvalidGitpodYMLError } from "./config-provider";
import { ProjectsService } from "../projects/projects-service";
import { LocalMessageBroker } from "../messaging/local-message-broker";
import { CachingBlobServiceClientProvider } from '@gitpod/content-service/lib/sugar';
import { IDEOptions } from '@gitpod/gitpod-protocol/lib/ide-protocol';
import { IDEConfigService } from '../ide-config';
import { PartialProject } from '@gitpod/gitpod-protocol/src/teams-projects-protocol';
import { ClientMetadata } from '../websocket/websocket-connection-manager';
import { ConfigurationService } from '../config/configuration-service';
import { ProjectEnvVar } from '@gitpod/gitpod-protocol/src/protocol';
import { InstallationAdminSettings } from '@gitpod/gitpod-protocol';

// shortcut
export const traceWI = (ctx: TraceContext, wi: Omit<LogContext, "userId">) => TraceContext.setOWI(ctx, wi);    // userId is already taken care of in WebsocketConnectionManager
export const traceAPIParams = (ctx: TraceContext, params: { [key: string]: any }) => TraceContext.addJsonRPCParameters(ctx, params);
export function censor<T>(obj: T, k: keyof T): T { const r = { ...obj }; delete (r as any)[k]; return r; }


export type GitpodServerWithTracing = InterfaceWithTraceContext<GitpodServer>;

@injectable()
export class GitpodServerImpl implements GitpodServerWithTracing, Disposable {

    @inject(Config) protected readonly config: Config;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(WorkspaceFactory) protected readonly workspaceFactory: WorkspaceFactory;
    @inject(WorkspaceDeletionService) protected readonly workspaceDeletionService: WorkspaceDeletionService;
    @inject(LocalMessageBroker) protected readonly localMessageBroker: LocalMessageBroker;
    @inject(ContextParser) protected contextParser: ContextParser;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(GitpodFileParser) protected readonly gitpodParser: GitpodFileParser;
    @inject(InstallationAdminDB) protected readonly installationAdminDb: InstallationAdminDB;

    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(WorkspaceManagerClientProvider) protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;
    @inject(ImageBuilderClientProvider) protected imageBuilderClientProvider: ImageBuilderClientProvider;

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(UserService) protected readonly userService: UserService;
    @inject(UserMessageViewsDB) protected readonly userMessageViewsDB: UserMessageViewsDB;
    @inject(UserStorageResourcesDB) protected readonly userStorageResourcesDB: UserStorageResourcesDB;
    @inject(UserDeletionService) protected readonly userDeletionService: UserDeletionService;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(AuthorizationService) protected readonly authorizationService: AuthorizationService;
    @inject(TeamDB) protected readonly teamDB: TeamDB;

    @inject(AppInstallationDB) protected readonly appInstallationDB: AppInstallationDB;

    @inject(IClientDataPrometheusAdapter) protected readonly clientDataPrometheusAdapter: IClientDataPrometheusAdapter;

    @inject(TheiaPluginService) protected readonly pluginService: TheiaPluginService;

    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;

    @inject(TermsProvider) protected readonly termsProvider: TermsProvider;

    @inject(CachingBlobServiceClientProvider) protected readonly blobServiceClientProvider: CachingBlobServiceClientProvider;

    @inject(GitTokenScopeGuesser) protected readonly gitTokenScopeGuesser: GitTokenScopeGuesser;

    @inject(HeadlessLogService) protected readonly headlessLogService: HeadlessLogService;

    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(ProjectsService) protected readonly projectsService: ProjectsService;

    @inject(ConfigurationService) protected readonly configurationService: ConfigurationService;

    @inject(IDEConfigService) protected readonly ideConfigService: IDEConfigService;

    /** Id the uniquely identifies this server instance */
    public readonly uuid: string = uuidv4();
    public readonly clientMetadata: ClientMetadata;
    protected connectionCtx: TraceContext | undefined = undefined;
    protected clientHeaderFields: ClientHeaderFields;
    protected resourceAccessGuard: ResourceAccessGuard;
    protected client: GitpodApiClient | undefined;

    protected user: User | undefined;

    protected readonly disposables = new DisposableCollection();

    dispose(): void {
        this.disposables.dispose();
    }

    initialize(client: GitpodApiClient | undefined, user: User | undefined, accessGuard: ResourceAccessGuard, clientMetadata: ClientMetadata, connectionCtx: TraceContext | undefined, clientHeaderFields: ClientHeaderFields): void {
        if (client) {
            this.disposables.push(Disposable.create(() => this.client = undefined));
        }
        this.client = client;
        this.user = user;
        this.resourceAccessGuard = accessGuard;
        this.clientHeaderFields = clientHeaderFields;
        (this.clientMetadata as any) = clientMetadata;
        this.connectionCtx = connectionCtx;

        log.debug({ userId: this.user?.id }, `clientRegion: ${clientHeaderFields.clientRegion}`);
        log.debug({ userId: this.user?.id }, 'initializeClient');

        this.listenForWorkspaceInstanceUpdates();
    }

    protected listenForWorkspaceInstanceUpdates(): void {
        if (!this.user || !this.client) {
            return;
        }

        // TODO(cw): the instance update is not subject to resource access guards, hence provides instance info
        //           to clients who might not otherwise have access to that information.
        this.disposables.push(this.localMessageBroker.listenForWorkspaceInstanceUpdates(
            this.user.id,
            (ctx, instance) => TraceContext.withSpan("forwardInstanceUpdateToClient", () => this.client?.onInstanceUpdate(this.censorInstance(instance)), ctx, this.connectionCtx?.span)
        ));

    }

    setClient(ctx: TraceContext, client: GitpodApiClient | undefined): void {
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
        // @ts-ignore
        delete (res.workspaceImage);

        return res;
    }

    protected checkUser(methodName?: string, logPayload?: {}, ctx?: LogContext): User {
        if (this.showSetupCondition?.value) {
            throw new ResponseError(ErrorCodes.SETUP_REQUIRED, 'Setup required.');
        }
        if (!this.user) {
            throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, 'User is not authenticated. Please login.');
        }
        if (this.user.markedDeleted === true) {
            throw new ResponseError(ErrorCodes.USER_DELETED, 'User has been deleted.');
        }
        const userContext: LogContext = {
            ...ctx,
            userId: this.user.id,
        };
        if (methodName) {
            let payload = { api: true };
            if (logPayload) {
                payload = { ...logPayload, ...payload };
            }
            log.debug(userContext, methodName, payload);
        }
        return this.user;
    }

    protected checkAndBlockUser(methodName?: string, logPayload?: {}, ctx?: LogContext): User {
        const user = this.checkUser(methodName, logPayload);
        if (user.blocked) {
            const userContext: LogContext = {
                ...ctx,
                userId: user.id,
            };
            let payload = { api: true };
            if (logPayload) {
                payload = { ...logPayload, ...payload };
            }
            log.debug(userContext, `${methodName || 'checkAndBlockUser'}: blocked`, payload);
            throw new ResponseError(ErrorCodes.USER_BLOCKED, "You've been blocked.");
        }
        return user;
    }


    public async getLoggedInUser(ctx: TraceContext): Promise<User> {
        await this.doUpdateUser();
        return this.checkUser("getLoggedInUser");
    }

    protected showSetupCondition: { value: boolean } | undefined = undefined;
    protected async doUpdateUser(): Promise<void> {

        // execute the check for the setup to be shown until the setup is not required.
        // cf. evaluation of the condition in `checkUser`
        if (!this.showSetupCondition || this.showSetupCondition.value === true) {
            const hasAnyStaticProviders = this.hostContextProvider.getAll().some(hc => hc.authProvider.params.builtin === true);
            if (!hasAnyStaticProviders) {
                const userCount = await this.userDB.getUserCount();
                this.showSetupCondition = { value: userCount === 0 };
            } else {
                this.showSetupCondition = { value: false };
            }
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

    public async updateLoggedInUser(ctx: TraceContext, partialUser: Partial<User>): Promise<User> {
        traceAPIParams(ctx, {});    // partialUser contains PII

        const user = this.checkUser('updateLoggedInUser');
        await this.guardAccess({ kind: "user", subject: user }, "update");

        const allowedFields: (keyof User)[] = ['avatarUrl', 'fullName', 'additionalData'];
        for (const p of allowedFields) {
            if (p in partialUser) {
                (user[p] as any) = partialUser[p];
            }
        }

        await this.userDB.updateUserPartial(user);
        return user;
    }

    public async getClientRegion(ctx: TraceContext): Promise<string | undefined> {
        this.checkUser("getClientRegion");
        return this.clientHeaderFields?.clientRegion;
    }

    /**
     * Returns the descriptions of auth providers. This also controls the visibility of
     * auth providers on the dashbard.
     *
     * If this call is unauthenticated (i.e. for anonumous users,) it returns only information
     * necessary for the Login page.
     *
     * If there are built-in auth providers configured, only these are returned.
     */
    public async getAuthProviders(ctx: TraceContext): Promise<AuthProviderInfo[]> {
        const { builtinAuthProvidersConfigured } = this.config;

        const hostContexts = this.hostContextProvider.getAll();
        const authProviders = hostContexts.map(hc => hc.authProvider.info);

        const isBuiltIn = (info: AuthProviderInfo) => !info.ownerId;
        const isNotHidden = (info: AuthProviderInfo) => !info.hiddenOnDashboard;
        const isVerified = (info: AuthProviderInfo) => info.verified;

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
            let result = authProviders.filter(isNotHidden).filter(isVerified);
            if (builtinAuthProvidersConfigured) {
                result = result.filter(isBuiltIn);
            }
            return result.map(toPublic);
        }

        // otherwise show all the details
        const result: AuthProviderInfo[] = [];
        for (const info of authProviders) {
            const identity = this.user.identities.find(i => i.authProviderId === info.authProviderId);
            if (identity) {
                result.push({ ...info, isReadonly: identity.readonly });
                continue;
            }
            if (info.ownerId === this.user.id) {
                result.push(info);
                continue;
            }
            if (builtinAuthProvidersConfigured && !isBuiltIn(info)) {
                continue;
            }
            if (isNotHidden(info) && isVerified(info)) {
                result.push(info);
            }
        }
        return result;
    }

    public async getConfiguration(ctx: TraceContext): Promise<Configuration> {
        return {
            garbageCollectionStartDate: this.config.workspaceGarbageCollection.startDate,
            daysBeforeGarbageCollection: this.config.workspaceGarbageCollection.minAgeDays,
        }
    }

    public async getToken(ctx: TraceContext, query: GitpodServer.GetTokenSearchOptions): Promise<Token | undefined> {
        traceAPIParams(ctx, { query });

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
            return undefined;
        }
    }

    public async getPortAuthenticationToken(ctx: TraceContext, workspaceId: string): Promise<Token> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = this.checkAndBlockUser("getPortAuthenticationToken", { workspaceId });

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        await this.guardAccess({ kind: "workspace", subject: workspace! }, "get");

        const token = await this.tokenProvider.getFreshPortAuthenticationToken(user, workspaceId);
        await this.guardAccess({ kind: "token", subject: token, tokenOwnerID: user.id }, "create");

        return token;
    }

    public async deleteAccount(ctx: TraceContext): Promise<void> {
        const user = this.checkUser("deleteAccount");
        await this.guardAccess({ kind: "user", subject: user! }, "delete");

        await this.userDeletionService.deleteUser(user.id);
    }

    protected async getTeamMembersByProject(projectId: string | undefined): Promise<TeamMemberInfo[]> {
        if (projectId) {
            const project = await this.projectsService.getProject(projectId);
            if (project && project.teamId) {
                return await this.teamDB.findMembersByTeam(project.teamId);
            }
        }
        return [];
    }

    public async getWorkspace(ctx: TraceContext, workspaceId: string): Promise<WorkspaceInfo> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        this.checkUser('getWorkspace');

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        const latestInstancePromise = this.workspaceDb.trace(ctx).findCurrentInstance(workspaceId);
        const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
        await this.guardAccess({ kind: "workspace", subject: workspace, teamMembers }, "get");
        const latestInstance = await latestInstancePromise;
        if (!!latestInstance) {
            await this.guardAccess({
                kind: "workspaceInstance",
                subject: latestInstance,
                workspace,
                teamMembers,
            }, "get");
        }

        return {
            workspace,
            latestInstance: this.censorInstance(latestInstance)
        };
    }

    public async getOwnerToken(ctx: TraceContext, workspaceId: string): Promise<string> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        this.checkUser('getOwnerToken');

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace) {
            throw new Error('owner token not found');
        }
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        const latestInstance = await this.workspaceDb.trace(ctx).findCurrentInstance(workspaceId);
        this.guardAccess({ kind: "workspaceInstance", subject: latestInstance, workspace }, "get");

        const ownerToken = latestInstance?.status.ownerToken;
        if (!ownerToken) {
            throw new Error('owner token not found');
        }
        return ownerToken;
    }

    public async startWorkspace(ctx: TraceContext, workspaceId: string, options: GitpodServer.StartWorkspaceOptions): Promise<StartWorkspaceResult> {
        traceAPIParams(ctx, { workspaceId, options });
        traceWI(ctx, { workspaceId });

        const user = this.checkAndBlockUser("startWorkspace", undefined, { workspaceId });
        await this.checkTermsAcceptance();

        const mayStartPromise = this.mayStartWorkspace(ctx, user, this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id));
        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        const runningInstance = await this.workspaceDb.trace(ctx).findRunningInstance(workspace.id);
        if (runningInstance) {
            traceWI(ctx, { instanceId: runningInstance.id });

            // We already have a running workspace.
            // Note: ownership doesn't matter here as this is basically a noop. It's not StartWorkspace's concern
            //       to guard workspace access - just to prevent non-owners from starting workspaces.

            await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace }, "get");
            return {
                instanceID: runningInstance.id,
                workspaceURL: runningInstance.ideUrl,
            };
        }

        if (!!workspace.softDeleted) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Workspace not found!");
        }

        // no matter if the workspace is shared or not, you cannot create a new instance
        await this.guardAccess({ kind: "workspaceInstance", subject: undefined, workspace }, "create");

        if (workspace.type !== "regular") {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Cannot (re-)start irregular workspace.");
        }

        if (workspace.deleted) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Cannot (re-)start a deleted workspace.");
        }
        const userEnvVars = this.userDB.getEnvVars(user.id);
        let projectEnvVarsPromise = this.internalGetPublicProjectEnvVars(workspace.projectId);

        await mayStartPromise;

        // at this point we're about to actually start a new workspace
        const result = await this.workspaceStarter.startWorkspace(ctx, workspace, user, await userEnvVars, await projectEnvVarsPromise, {
            forceDefaultImage: !!options.forceDefaultImage
        });
        traceWI(ctx, { instanceId: result.instanceID });
        return result;
    }

    public async stopWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = this.checkUser('stopWorkspace', undefined, { workspaceId });
        const logCtx = { userId: user.id, workspaceId };

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        if (workspace.type === 'prebuild') {
            // If this is a team prebuild, any team member can stop it.
            const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
            await this.guardAccess({ kind: "workspace", subject: workspace, teamMembers }, "get");
        } else {
            // If this is not a prebuild, or it's a personal prebuild, only the workspace owner can stop it.
            await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        }

        this.internalStopWorkspace(ctx, workspace).catch(err => {
            log.error(logCtx, "stopWorkspace error: ", err);
        });
    }

    protected async internalStopWorkspace(ctx: TraceContext, workspace: Workspace, policy?: StopWorkspacePolicy, admin: boolean = false): Promise<void> {
        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspace.id);
        if (!instance) {
            // there's no instance running - we're done
            return;
        }

        // If it's an admin that wants to stop a workspace, don't check if it's
        // the workspace of the logged in user (it is not, since it's the admin
        // that is logged in).
        // The guard check happens in guardAdminAccess(...) for admin users.
        if (!admin) {
            if (workspace.type === 'prebuild') {
                // If this is a team prebuild, any team member can stop it.
                const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
                await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace, teamMembers }, "update");
            } else {
                // If this is not a prebuild, or it's a personal prebuild, only the workspace owner can stop it.
                await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace }, "update");
            }
        }
        await this.internalStopWorkspaceInstance(ctx, instance.id, instance.region, policy);
    }

    protected async guardAdminAccess(method: string, params: any, requiredPermission: PermissionName) {
        const user = this.checkAndBlockUser(method);
        if (!this.authorizationService.hasPermission(user, requiredPermission)) {
            log.warn({ userId: this.user?.id }, "unauthorised admin access", { authorised: false, method, params });
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }
        log.info({ userId: this.user?.id }, "admin access", { authorised: true, method, params });
    }

    protected async internalStopWorkspaceInstance(ctx: TraceContext, instanceId: string, instanceRegion: string, policy?: StopWorkspacePolicy): Promise<void> {
        const req = new StopWorkspaceRequest();
        req.setId(instanceId);
        req.setPolicy(policy || StopWorkspacePolicy.NORMALLY);

        const client = await this.workspaceManagerClientProvider.get(instanceRegion);
        await client.stopWorkspace(ctx, req);
    }

    public async updateWorkspaceUserPin(ctx: TraceContext, workspaceId: string, action: "pin" | "unpin" | "toggle"): Promise<void> {
        traceAPIParams(ctx, { workspaceId, action });
        traceWI(ctx, { workspaceId });

        this.checkAndBlockUser('updateWorkspacePin');

        await this.workspaceDb.trace(ctx).transaction(async db => {
            const ws = await this.internalGetWorkspace(workspaceId, db);
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
    }

    public async deleteWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        this.checkAndBlockUser('deleteWorkspace');

        const ws = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: ws }, "delete");

        // for good measure, try and stop running instances
        await this.internalStopWorkspace(ctx, ws);

        // actually delete the workspace
        await this.workspaceDeletionService.softDeleteWorkspace(ctx, ws, "user");
    }

    public async controlAdmission(ctx: TraceContext, workspaceId: string, level: "owner" | "everyone"): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Workspace sharing support is implemented in Gitpod's Enterprise Edition`)
    }

    public async setWorkspaceDescription(ctx: TraceContext, workspaceId: string, description: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId, description });
        traceWI(ctx, { workspaceId });

        this.checkAndBlockUser('setWorkspaceDescription');

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));

        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");
        await this.workspaceDb.trace(ctx).updatePartial(workspaceId, { description });
    }

    public async getWorkspaces(ctx: TraceContext, options: GitpodServer.GetWorkspacesOptions): Promise<WorkspaceInfo[]> {
        traceAPIParams(ctx, { options });

        const user = this.checkUser("getWorkspaces");

        const res = await this.workspaceDb.trace(ctx).find({
            limit: 20,
            ...options,
            userId: user.id,
            includeHeadless: false,
        });
        await Promise.all(res.map(ws => this.guardAccess({ kind: "workspace", subject: ws.workspace }, "get")));
        await Promise.all(res.map(ws => this.guardAccess({ kind: "workspaceInstance", subject: ws.latestInstance, workspace: ws.workspace }, "get")));
        return res;
    }

    public async isWorkspaceOwner(ctx: TraceContext, workspaceId: string): Promise<boolean> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = this.checkUser("isWorkspaceOwner", undefined, { workspaceId });

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        return user.id == workspace.ownerId;
    }

    public async sendHeartBeat(ctx: TraceContext, options: GitpodServer.SendHeartBeatOptions): Promise<void> {
        traceAPIParams(ctx, { options });
        const { instanceId } = options;
        traceWI(ctx, { instanceId });

        const user = this.checkAndBlockUser("sendHeartBeat", undefined, { instanceId });

        try {
            const wsi = await this.workspaceDb.trace(ctx).findInstanceById(instanceId);
            if (!wsi) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "workspace does not exist");
            }

            const ws = await this.workspaceDb.trace(ctx).findById(wsi.workspaceId);
            if (!ws) {
                throw new ResponseError(ErrorCodes.NOT_FOUND, "workspace does not exist");
            }
            await this.guardAccess({ kind: "workspaceInstance", subject: wsi, workspace: ws }, "update");

            const wasClosed = !!(options && options.wasClosed);
            await this.workspaceDb.trace(ctx).updateLastHeartbeat(instanceId, user.id, new Date(), wasClosed);

            const req = new MarkActiveRequest();
            req.setId(instanceId);
            req.setClosed(wasClosed);

            const client = await this.workspaceManagerClientProvider.get(wsi.region);
            await client.markActive(ctx, req);

            if (options && options.roundTripTime && Number.isFinite(options.roundTripTime)) {
                this.clientDataPrometheusAdapter.storeWorkspaceRoundTripTimeSample(user, instanceId, options.roundTripTime);
            }
        } catch (e) {
            if (e.message && typeof (e.message) === 'string' && (e.message as String).endsWith("does not exist")) {
                // This is an old tab with open workspace: drop silently
                return;
            } else {
                throw e;
            }
        }
    }

    async getWorkspaceOwner(ctx: TraceContext, workspaceId: string): Promise<UserInfo | undefined> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        const owner = await this.userDB.findUserById(workspace.ownerId);
        if (!owner) {
            return undefined;
        }

        await this.guardAccess({ kind: "user", subject: owner }, "get");
        return { name: owner.name };
    }

    public async getWorkspaceUsers(ctx: TraceContext, workspaceId: string): Promise<WorkspaceInstanceUser[]> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        this.checkUser("getWorkspaceUsers", undefined, { workspaceId });

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        // Note: there's no need to try and guard the users below, they're not complete users but just enough to
        //       to support the workspace sharing. The access guard above is enough.
        return await this.workspaceDb.trace(ctx).getWorkspaceUsers(workspaceId, this.config.workspaceHeartbeat.timeoutSeconds * 1000);
    }

    protected async internalGetWorkspace(id: string, db: WorkspaceDB): Promise<Workspace> {
        const ws = await db.findById(id);
        if (!ws) {
            throw new Error(`No workspace with id '${id}' found.`);
        }
        return ws;
    }

    private async findRunningInstancesForContext(ctx: TraceContext, contextPromise: Promise<WorkspaceContext>, contextUrl: string, runningInstancesPromise: Promise<WorkspaceInstance[]>): Promise<WorkspaceInfo[]> {
        const span = TraceContext.startSpan("findRunningInstancesForContext", ctx);
        try {
            const runningInstances = (await runningInstancesPromise).filter(instance => instance.status.phase !== 'stopping');
            const runningInfos = await Promise.all(runningInstances.map(async workspaceInstance => {
                const workspace = await this.workspaceDb.trace(ctx).findById(workspaceInstance.workspaceId);
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
            TraceContext.setError(ctx, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async isPrebuildDone(ctx: TraceContext, pwsid: string): Promise<boolean> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, "Prebuilds are implemented in Gitpod's enterprise edition")
    }

    public async createWorkspace(ctx: TraceContext, options: GitpodServer.CreateWorkspaceOptions): Promise<WorkspaceCreationResult> {
        traceAPIParams(ctx, { options });

        const contextUrl = options.contextUrl;
        const mode = options.mode || CreateWorkspaceMode.Default;
        let normalizedContextUrl: string = "";
        let logContext: LogContext = {};

        try {
            const user = this.checkAndBlockUser("createWorkspace", { mode });
            await this.checkTermsAcceptance();

            const envVars = this.userDB.getEnvVars(user.id);
            logContext = { userId: user.id };

            // Credit check runs in parallel with the other operations up until we start consuming resources.
            // Make sure to await for the creditCheck promise in the right places.
            const runningInstancesPromise = this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
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
                this.mayStartWorkspace(ctx, user, runningInstancesPromise),
            ]);

            // if we're forced to use the default config, mark the context as such
            if (!!options.forceDefaultConfig) {
                context = WithDefaultConfig.mark(context);
            }

            // if this is an explicit prebuild, check if the user wants to install an app.
            if (StartPrebuildContext.is(context) && CommitContext.is(context.actual) && context.actual.repository.cloneUrl) {
                const cloneUrl = context.actual.repository.cloneUrl;
                const host = new URL(cloneUrl).hostname;
                const hostContext = this.hostContextProvider.get(host);
                const services = hostContext && hostContext.services;
                if (!hostContext || !services) {
                    console.error('Unknown host: ' + host);
                } else {
                    // on purpose to not await on that installation process, because it‘s not required of workspace start
                    // See https://github.com/gitpod-io/gitpod/pull/6420#issuecomment-953499632 for more detail
                    (async () => {
                        if (await services.repositoryService.canInstallAutomatedPrebuilds(user, cloneUrl)) {
                            console.log('Installing automated prebuilds for ' + cloneUrl);
                            await services.repositoryService.installAutomatedPrebuilds(user, cloneUrl);
                        }
                    })().catch((e) => console.error('Install automated prebuilds failed', e))
                }
            }

            if (mode === CreateWorkspaceMode.SelectIfRunning && context.forceCreateNewWorkspace !== true) {
                const runningForContext = await runningForContextPromise;
                if (runningForContext.length > 0) {
                    return { existingWorkspaces: runningForContext }
                }
            }

            const prebuiltWorkspace = await this.findPrebuiltWorkspace(ctx, user, context, mode);
            if (WorkspaceCreationResult.is(prebuiltWorkspace)) {
                ctx.span?.log({ prebuild: "running" });
                return prebuiltWorkspace as WorkspaceCreationResult;
            }
            if (WorkspaceContext.is(prebuiltWorkspace)) {
                ctx.span?.log({ prebuild: "available" });
                context = prebuiltWorkspace;
            }

            const workspace = await this.workspaceFactory.createForContext(ctx, user, context, normalizedContextUrl);
            try {
                await this.guardAccess({ kind: "workspace", subject: workspace }, "create");
            } catch (err) {
                await this.workspaceDb.trace(ctx).hardDeleteWorkspace(workspace.id);
                throw err;
            }

            let projectEnvVarsPromise = this.internalGetPublicProjectEnvVars(workspace.projectId);

            logContext.workspaceId = workspace.id;
            traceWI(ctx, { workspaceId: workspace.id });
            const startWorkspaceResult = await this.workspaceStarter.startWorkspace(ctx, workspace, user, await envVars, await projectEnvVarsPromise);
            ctx.span?.log({ "event": "startWorkspaceComplete", ...startWorkspaceResult });

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
            if (InvalidGitpodYMLError.is(error)) {
                throw new ResponseError(ErrorCodes.INVALID_GITPOD_YML, error.message);
            }

            const errorCode = this.parseErrorCode(error);
            if (errorCode) {
                // specific errors will be handled in create-workspace.tsx
                throw error;
            }
            log.debug(logContext, error);
            throw new ResponseError(ErrorCodes.CONTEXT_PARSE_ERROR, (error && error.message) ? error.message
                : `Cannot create workspace for URL: ${normalizedContextUrl}`);
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

    protected async pollDatabaseUntilPrebuildIsAvailable(ctx: TraceContext, prebuildID: string, timeoutMS: number): Promise<PrebuiltWorkspace | undefined> {
        const pollPrebuildAvailable = new Cancelable(async cancel => {
            const prebuild = await this.workspaceDb.trace(ctx).findPrebuildByID(prebuildID);
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

    public async getFeaturedRepositories(ctx: TraceContext): Promise<WhitelistedRepository[]> {
        const user = this.checkUser("getFeaturedRepositories");
        const repositories = await this.workspaceDb.trace(ctx).getFeaturedRepositories();
        if (repositories.length === 0) return [];

        return (await Promise.all(repositories
            .filter(repo => repo.url != undefined)
            .map(async whitelistedRepo => {
                const repoUrl = RepoURL.parseRepoUrl(whitelistedRepo.url!);
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

    public async setWorkspaceTimeout(ctx: TraceContext, workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Custom workspace timeout is implemented in Gitpod's Enterprise Edition`);
    }

    public async getWorkspaceTimeout(ctx: TraceContext, workspaceId: string): Promise<GetWorkspaceTimeoutResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Custom workspace timeout is implemented in Gitpod's Enterprise Edition`);
    }

    public async getOpenPorts(ctx: TraceContext, workspaceId: string): Promise<WorkspaceInstancePort[]> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        this.checkUser("getOpenPorts");

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!instance || !workspace) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
        }

        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace }, "get");

        const req = new DescribeWorkspaceRequest();
        req.setId(instance.id);
        const client = await this.workspaceManagerClientProvider.get(instance.region);
        const desc = await client.describeWorkspace(ctx, req);

        if (!desc.hasStatus()) {
            throw new Error("describeWorkspace returned no status");
        }

        const status = desc.getStatus()!;
        const ports = status.getSpec()!.getExposedPortsList().map(p => <WorkspaceInstancePort>{
            port: p.getPort(),
            url: p.getUrl(),
            visibility: this.portVisibilityFromProto(p.getVisibility())
        });

        return ports;
    }

    public async openPort(ctx: TraceContext, workspaceId: string, port: WorkspaceInstancePort): Promise<WorkspaceInstancePort | undefined> {
        traceAPIParams(ctx, { workspaceId, port });
        traceWI(ctx, { workspaceId });

        const user = this.checkAndBlockUser("openPort");

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        const runningInstance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!runningInstance) {
            log.debug({ userId: user.id, workspaceId }, 'Cannot open port for workspace with no running instance', { port });
            return;
        }
        traceWI(ctx, { instanceId: runningInstance.id });
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace }, "update");

        const req = new ControlPortRequest();
        req.setId(runningInstance.id);
        const spec = new PortSpec();
        spec.setPort(port.port);
        spec.setVisibility(this.portVisibilityToProto(port.visibility))
        req.setSpec(spec);
        req.setExpose(true);

        const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
        await client.controlPort(ctx, req);
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
            default:    // the default for requests is: private
            case 'private':
                return ProtoPortVisibility.PORT_VISIBILITY_PRIVATE;
            case 'public':
                return ProtoPortVisibility.PORT_VISIBILITY_PUBLIC;
        }
    }

    public async closePort(ctx: TraceContext, workspaceId: string, port: number) {
        traceAPIParams(ctx, { workspaceId, port });
        traceWI(ctx, { workspaceId });

        const user = this.checkAndBlockUser("closePort");

        const { workspace, instance } = await this.internGetCurrentWorkspaceInstance(ctx, workspaceId);
        if (!instance || instance.status.phase !== 'running') {
            log.debug({ userId: user.id, workspaceId }, 'Cannot close a port for a workspace which has no running instance', { port });
            return;
        }
        traceWI(ctx, { instanceId: instance.id });
        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace }, "update");

        const req = new ControlPortRequest();
        req.setId(instance.id);
        const spec = new PortSpec();
        spec.setPort(port);
        req.setSpec(spec);
        req.setExpose(false);

        const client = await this.workspaceManagerClientProvider.get(instance.region);
        await client.controlPort(ctx, req);
    }

    async watchWorkspaceImageBuildLogs(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = this.checkAndBlockUser("watchWorkspaceImageBuildLogs", undefined, { workspaceId });
        const logCtx: LogContext = { userId: user.id, workspaceId };

        const { instance, workspace } = await this.internGetCurrentWorkspaceInstance(ctx, workspaceId);
        if (!this.client) {
            return;
        }
        if (!instance) {
            log.debug(logCtx, `No running instance for workspaceId.`);
            return;
        }
        traceWI(ctx, { instanceId: instance.id });
        if (!workspace.imageNameResolved) {
            log.debug(logCtx, `No imageNameResolved set for workspaceId, cannot watch logs.`);
            return;
        }
        const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace, teamMembers }, "get");
        if (!this.client) {
            return;
        }

        try {
            const imgbuilder = this.imageBuilderClientProvider.getDefault();
            const req = new LogsRequest();
            req.setCensored(true);
            req.setBuildRef(workspace.imageNameResolved);

            let lineCount = 0;
            imgbuilder.logs(ctx, req, data => {
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
            log.error(logCtx, `cannot watch logs for workspaceId`, err)
        }
    }

    async getHeadlessLog(ctx: TraceContext, instanceId: string): Promise<HeadlessLogUrls> {
        traceAPIParams(ctx, { instanceId });

        this.checkAndBlockUser('getHeadlessLog', { instanceId });
        const logCtx: LogContext = { instanceId };

        const ws = await this.workspaceDb.trace(ctx).findByInstanceId(instanceId);
        if (!ws) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${instanceId} not found`);
        }

        const wsiPromise = this.workspaceDb.trace(ctx).findInstanceById(instanceId);
        const teamMembers = await this.getTeamMembersByProject(ws.projectId);

        await this.guardAccess({ kind: 'workspace', subject: ws, teamMembers }, 'get');

        const wsi = await wsiPromise;
        if (!wsi) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace instance for ${instanceId} not found`);
        }

        const urls = await this.headlessLogService.getHeadlessLogURLs(logCtx, wsi, ws.ownerId);
        if (!urls || (typeof urls.streams === "object" && Object.keys(urls.streams).length === 0)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Headless logs for ${instanceId} not found`);
        }
        return urls;
    }

    protected async internGetCurrentWorkspaceInstance(ctx: TraceContext, workspaceId: string): Promise<{ workspace: Workspace, instance: WorkspaceInstance | undefined }> {
        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        return { instance, workspace };
    }

    async getUserStorageResource(ctx: TraceContext, options: GitpodServer.GetUserStorageResourceOptions): Promise<string> {
        traceAPIParams(ctx, { options });

        const uri = options.uri;
        const userId = this.checkUser("getUserStorageResource", { uri: options.uri }).id;

        await this.guardAccess({ kind: "userStorage", uri, userID: userId }, "get");

        return await this.userStorageResourcesDB.get(userId, uri);
    }

    async updateUserStorageResource(ctx: TraceContext, options: GitpodServer.UpdateUserStorageResourceOptions): Promise<void> {
        traceAPIParams(ctx, { options: censor(options, "content") });   // because may contain PII, and size (arbitrary files are stored here)

        const { uri, content } = options;
        const userId = this.checkAndBlockUser("updateUserStorageResource", { uri: options.uri }).id;

        await this.guardAccess({ kind: "userStorage", uri, userID: userId }, "update");

        await this.userStorageResourcesDB.update(userId, uri, content);
    }


    async sendFeedback(ctx: TraceContext, feedback: string): Promise<string | undefined> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, 'Sending feedback is not implemented');
    }

    async registerGithubApp(ctx: TraceContext, installationId: string): Promise<void> {
        traceAPIParams(ctx, { installationId });

        const user = this.checkAndBlockUser();

        if (!this.config.githubApp?.enabled) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, 'No GitHub app enabled for this installation. Please talk to your administrator.');
        }

        await this.appInstallationDB.recordNewInstallation('github', 'user', installationId, user.id);
    }

    async takeSnapshot(ctx: TraceContext, options: GitpodServer.TakeSnapshotOptions): Promise<string> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Snapshot support is implemented in Gitpod's Enterprise Edition`);
    }

    async waitForSnapshot(ctx: TraceContext, snapshotId: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Snapshot support is implemented in Gitpod's Enterprise Edition`);
    }

    async getSnapshots(ctx: TraceContext, workspaceId: string): Promise<string[]> {
        // this is an EE feature. Throwing an exception here would break the dashboard though.
        return [];
    }

    /**
     * stores/updates layout information for the given workspace
     */
    async storeLayout(ctx: TraceContext, workspaceId: string, layoutData: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });   // leave out layoutData because of size (> 64KiB in some cases)
        traceWI(ctx, { workspaceId });

        const user = this.checkAndBlockUser("storeLayout");
        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace || workspace.ownerId !== user.id) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
        }

        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");

        await this.workspaceDb.trace(ctx).storeLayoutData({
            workspaceId,
            lastUpdatedTime: new Date().toISOString(),
            layoutData
        });
    }

    /**
     * retrieves layout information for the given workspace
     */
    async getLayout(ctx: TraceContext, workspaceId: string): Promise<string | undefined> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        this.checkUser("storeLayout");

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace) {
            return;
        }
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        const layoutData = await this.workspaceDb.trace(ctx).findLayoutDataByWorkspaceId(workspaceId);
        if (!layoutData) {
            return;
        }
        return layoutData.layoutData;
    }

    // Get environment variables (filter by repository pattern precedence)
    async getEnvVars(ctx: TraceContext): Promise<UserEnvVarValue[]> {
        const user = this.checkUser("getEnvVars");
        const result = new Map<string, { value: UserEnvVar, score: number }>();
        for (const value of await this.userDB.getEnvVars(user.id)) {
            if (!await this.resourceAccessGuard.canAccess({ kind: 'envVar', subject: value }, 'get')) {
                continue;
            }
            const score = UserEnvVar.score(value);
            const current = result.get(value.name);
            if (!current || score < current.score) {
                result.set(value.name, { value, score });
            }
        }
        return [...result.values()]
            .map(({ value: { id, name, value, repositoryPattern } }) => ({ id, name, value, repositoryPattern }));
    }

    // Get all environment variables (unfiltered)
    async getAllEnvVars(ctx: TraceContext): Promise<UserEnvVarValue[]> {
        const user = this.checkUser("getAllEnvVars");
        const result: UserEnvVarValue[] = [];
        for (const value of await this.userDB.getEnvVars(user.id)) {
            if (!await this.resourceAccessGuard.canAccess({ kind: 'envVar', subject: value }, 'get')) {
                continue;
            }
            result.push({
                id: value.id,
                name: value.name,
                value: value.value,
                repositoryPattern: value.repositoryPattern,
            });
        }
        return result;
    }

    async setEnvVar(ctx: TraceContext, variable: UserEnvVarValue): Promise<void> {
        traceAPIParams(ctx, { variable: censor(variable, "value") });   // filter content because of PII

        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkAndBlockUser("setEnvVar");
        const userId = user.id;

        variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);
        const existingVars = (await this.userDB.getEnvVars(user.id)).filter(v => !v.deleted);

        const existingVar = existingVars.find(v => v.name == variable.name && v.repositoryPattern == variable.repositoryPattern);
        if (!!existingVar) {
            // overwrite existing variable rather than introduce a duplicate
            variable.id = existingVar.id;
        }

        if (!variable.id) {
            // this is a new variable - make sure the user does not have too many (don't DOS our database using gp env)
            const varCount = existingVars.length;
            if (varCount > this.config.maxEnvvarPerUserCount) {
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `cannot have more than ${this.config.maxEnvvarPerUserCount} environment variables`)
            }
        }

        const envvar: UserEnvVar = {
            id: variable.id || uuidv4(),
            name: variable.name,
            repositoryPattern: variable.repositoryPattern,
            value: variable.value,
            userId,
        };
        await this.guardAccess({ kind: 'envVar', subject: envvar }, typeof variable.id === 'string' ? 'update' : 'create');
        this.analytics.track({ event: "envvar-set", userId });

        await this.userDB.setEnvVar(envvar);
    }

    async deleteEnvVar(ctx: TraceContext, variable: UserEnvVarValue): Promise<void> {
        traceAPIParams(ctx, { variable: censor(variable, "value") });

        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkAndBlockUser("deleteEnvVar");
        const userId = user.id;

        if (!variable.id && variable.name && variable.repositoryPattern) {
            variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);
            const existingVars = (await this.userDB.getEnvVars(user.id)).filter(v => !v.deleted);
            const existingVar = existingVars.find(v => v.name == variable.name && v.repositoryPattern == variable.repositoryPattern);
            variable.id = existingVar?.id;
        }

        if (!variable.id) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `cannot delete '${variable.name}' in scope '${variable.repositoryPattern}'`)
        }

        const envvar: UserEnvVar = {
            ...variable,
            id: variable.id!,
            userId,
        };
        await this.guardAccess({ kind: 'envVar', subject: envvar }, 'delete');
        this.analytics.track({ event: "envvar-deleted", userId });

        await this.userDB.deleteEnvVar(envvar);
    }

    async setProjectEnvironmentVariable(ctx: TraceContext, projectId: string, name: string, value: string, censored: boolean): Promise<void> {
        traceAPIParams(ctx, { projectId, name }); // value may contain secrets
        const user = this.checkAndBlockUser("setProjectEnvironmentVariable");
        await this.guardProjectOperation(user, projectId, "update");
        return this.projectsService.setProjectEnvironmentVariable(projectId, name, value, censored);
    }

    async getProjectEnvironmentVariables(ctx: TraceContext, projectId: string): Promise<ProjectEnvVar[]> {
        traceAPIParams(ctx, { projectId });
        const user = this.checkAndBlockUser("getProjectEnvironmentVariables");
        await this.guardProjectOperation(user, projectId, "get");
        return this.projectsService.getProjectEnvironmentVariables(projectId);
    }

    async deleteProjectEnvironmentVariable(ctx: TraceContext, variableId: string): Promise<void> {
        traceAPIParams(ctx, { variableId });
        const user = this.checkAndBlockUser("deleteProjectEnvironmentVariable");
        const envVar = await this.projectsService.getProjectEnvironmentVariableById(variableId);
        if (!envVar) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project environment variable not found");
        }
        await this.guardProjectOperation(user, envVar.projectId, "update");
        return this.projectsService.deleteProjectEnvironmentVariable(envVar.id);
    }

    protected async internalGetPublicProjectEnvVars(projectId?: string): Promise<ProjectEnvVar[]> {
        if (!projectId) {
            return [];
        }
        const projectEnvVars = await this.projectsService.getProjectEnvironmentVariables(projectId);
        // Instead of using an access guard for Project environment variables, we let Project owners decide whether
        // a variable should be:
        //   - exposed in all workspaces (even for non-Project members when the repository is public), or
        //   - censored from all workspaces (even for Project members)
        return projectEnvVars.filter(variable => !variable.censored);
    }

    protected async guardTeamOperation(teamId: string | undefined, op: ResourceAccessOp): Promise<void> {
        const team = await this.teamDB.findTeamById(teamId || "");
        if (!team) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
        }
        const members = await this.teamDB.findMembersByTeam(team.id);
        await this.guardAccess({ kind: "team", subject: team, members }, op);
    }

    public async getTeams(ctx: TraceContext): Promise<Team[]> {
        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkUser("getTeams");
        return this.teamDB.findTeamsByUser(user.id);
    }

    public async getTeamMembers(ctx: TraceContext, teamId: string): Promise<TeamMemberInfo[]> {
        traceAPIParams(ctx, { teamId });

        this.checkUser("getTeamMembers");
        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
        }
        const members = await this.teamDB.findMembersByTeam(team.id);
        await this.guardAccess({ kind: "team", subject: team, members }, "get");
        return members;
    }

    public async createTeam(ctx: TraceContext, name: string): Promise<Team> {
        traceAPIParams(ctx, { name });

        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkAndBlockUser("createTeam");
        const team = await this.teamDB.createTeam(user.id, name);
        ctx.span?.setTag("teamId", team.id);
        this.analytics.track({
            userId: user.id,
            event: "team_created",
            properties: {
                id: team.id,
                name: team.name,
                slug: team.slug,
                created_at: team.creationTime
            }
        })
        return team;
    }

    public async joinTeam(ctx: TraceContext, inviteId: string): Promise<Team> {
        traceAPIParams(ctx, { inviteId });

        const user = this.checkAndBlockUser("joinTeam");
        // Invites can be used by anyone, as long as they know the invite ID, hence needs no resource guard
        const invite = await this.teamDB.findTeamMembershipInviteById(inviteId);
        if (!invite || invite.invalidationTime !== '') {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "The invite link is no longer valid.");
        }
        ctx.span?.setTag("teamId", invite.teamId);
        await this.teamDB.addMemberToTeam(user.id, invite.teamId);
        const team = await this.teamDB.findTeamById(invite.teamId);

        this.analytics.track({
            userId: user.id,
            event: "team_joined",
            properties: {
                team_id: invite.teamId,
                invite_id: inviteId
            }
        })
        return team!;
    }

    public async setTeamMemberRole(ctx: TraceContext, teamId: string, userId: string, role: TeamMemberRole): Promise<void> {
        traceAPIParams(ctx, { teamId, userId, role });

        this.checkAndBlockUser("setTeamMemberRole");
        await this.guardTeamOperation(teamId, "update");
        await this.teamDB.setTeamMemberRole(userId, teamId, role);
    }

    public async removeTeamMember(ctx: TraceContext, teamId: string, userId: string): Promise<void> {
        traceAPIParams(ctx, { teamId, userId });

        const user = this.checkAndBlockUser("removeTeamMember");
        // Users are free to leave any team themselves, but only owners can remove others from their teams.
        await this.guardTeamOperation(teamId, user.id === userId ? "get" : "update");
        await this.teamDB.removeMemberFromTeam(userId, teamId);
        this.analytics.track({
            userId: user.id,
            event: "team_user_removed",
            properties: {
                team_id: teamId,
                removed_user_id: userId
            }
        })
    }

    public async getGenericInvite(ctx: TraceContext, teamId: string): Promise<TeamMembershipInvite> {
        traceAPIParams(ctx, { teamId });

        this.checkUser("getGenericInvite");
        await this.guardTeamOperation(teamId, "get");
        const invite = await this.teamDB.findGenericInviteByTeamId(teamId);
        if (invite) {
            return invite;
        }
        return this.teamDB.resetGenericInvite(teamId);
    }

    public async resetGenericInvite(ctx: TraceContext, teamId: string): Promise<TeamMembershipInvite> {
        traceAPIParams(ctx, { teamId });

        this.checkAndBlockUser("resetGenericInvite");
        await this.guardTeamOperation(teamId, "update");
        return this.teamDB.resetGenericInvite(teamId);
    }

    protected async guardProjectOperation(user: User, projectId: string, op: ResourceAccessOp): Promise<void> {
        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        // TODO(janx): This if/else block should probably become a GuardedProject.
        if (project.userId) {
            if (user.id !== project.userId) {
                // Projects owned by a single user can only be accessed by that user
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Not allowed to access this project");
            }
        } else {
            // Anyone who can read a team's information (i.e. any team member) can manage team projects
            await this.guardTeamOperation(project.teamId, "get");
        }
    }

    public async getProviderRepositoriesForUser(ctx: TraceContext, params: { provider: string }): Promise<ProviderRepository[]> {
        traceAPIParams(ctx, { params });

        this.checkAndBlockUser("getProviderRepositoriesForUser");
        // Note: this operation is per-user only, hence needs no resource guard

        // implemented in EE
        return [];
    }

    public async createProject(ctx: TraceContext, params: CreateProjectParams): Promise<Project> {
        traceAPIParams(ctx, { params });

        const user = this.checkUser("createProject");
        if (params.userId) {
            if (params.userId !== user.id) {
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `Cannot create Projects for other users`);
            }
        } else {
            // Anyone who can read a team's information (i.e. any team member) can create a new project.
            await this.guardTeamOperation(params.teamId, "get");
        }
        const project = this.projectsService.createProject(params, user);
        this.analytics.track({
            userId: user.id,
            event: "project_created",
            properties: {
                name: params.name,
                clone_url: params.cloneUrl,
                account: params.account,
                provider: params.provider,
                owner_type: !!params.teamId ? "team" : "user",
                owner_id: !!params.teamId ? params.teamId : params.userId,
                app_installation_id: params.appInstallationId
            }
        })
        return project;
    }

    public async deleteProject(ctx: TraceContext, projectId: string): Promise<void> {
        traceAPIParams(ctx, { projectId });

        const user = this.checkUser("deleteProject");
        await this.guardProjectOperation(user, projectId, "delete");
        this.analytics.track({
            userId: user.id,
            event: "project_deleted",
            properties: {
                project_id: projectId
            }
        })
        return this.projectsService.deleteProject(projectId);
    }

    public async deleteTeam(ctx: TraceContext, teamId: string, userId: string): Promise<void> {
        traceAPIParams(ctx, { teamId, userId });

        const user = this.checkAndBlockUser("deleteTeam");

        await this.guardTeamOperation(teamId, "delete");

        const teamProjects = await this.projectsService.getTeamProjects(teamId);
        teamProjects.forEach(project => {
            this.deleteProject(ctx, project.id);
        })

        const teamMembers = await this.teamDB.findMembersByTeam(teamId);
        teamMembers.forEach(member => {
            this.removeTeamMember(ctx, teamId, member.userId);
        })

        await this.teamDB.deleteTeam(teamId);

        return this.analytics.track({
            userId: user.id,
            event: "team_deleted",
            properties: {
                team_id: teamId
            }
        });
    }

    public async getTeamProjects(ctx: TraceContext, teamId: string): Promise<Project[]> {
        traceAPIParams(ctx, { teamId });

        this.checkUser("getTeamProjects");

        await this.guardTeamOperation(teamId, "get");
        return this.projectsService.getTeamProjects(teamId);
    }

    public async getUserProjects(ctx: TraceContext): Promise<Project[]> {
        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkAndBlockUser("getUserProjects");
        return this.projectsService.getUserProjects(user.id);
    }

    public async findPrebuilds(ctx: TraceContext, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        traceAPIParams(ctx, { params });

        const user = this.checkAndBlockUser("getPrebuilds");
        await this.guardProjectOperation(user, params.projectId, "get");
        return this.projectsService.findPrebuilds(params);
    }

    public async getProjectOverview(ctx: TraceContext, projectId: string): Promise<Project.Overview | undefined> {
        traceAPIParams(ctx, { projectId });

        const user = this.checkAndBlockUser("getProjectOverview");
        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "get");
        try {
            return await this.projectsService.getProjectOverviewCached(user, project);
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }
            throw error;
        }
    }

    public async triggerPrebuild(ctx: TraceContext, projectId: string, branchName: string | null): Promise<StartPrebuildResult> {
        this.checkAndBlockUser("triggerPrebuild");
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Triggering Prebuilds is implemented in Gitpod's Enterprise Edition`);
    }

    public async cancelPrebuild(ctx: TraceContext, projectId: string, prebuildId: string): Promise<void> {
        this.checkAndBlockUser("cancelPrebuild");
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Cancelling Prebuilds is implemented in Gitpod's Enterprise Edition`);
    }

    public async fetchRepositoryConfiguration(ctx: TraceContext, cloneUrl: string): Promise<string | undefined> {
        traceAPIParams(ctx, { cloneUrl });
        const user = this.checkUser("fetchRepositoryConfiguration");
        try {
            return await this.configurationService.fetchRepositoryConfiguration(ctx, user, cloneUrl);
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }
            throw error;
        }
    }

    public async fetchProjectRepositoryConfiguration(ctx: TraceContext, projectId: string): Promise<string | undefined> {
        traceAPIParams(ctx, { projectId });
        const user = this.checkUser("fetchProjectRepositoryConfiguration");

        await this.guardProjectOperation(user, projectId, "get");

        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        try {
            return await this.configurationService.fetchRepositoryConfiguration(ctx, user, project.cloneUrl);
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }
            throw error;
        }
    }

    public async guessRepositoryConfiguration(ctx: TraceContext, cloneUrl: string): Promise<string | undefined> {
        const user = this.checkUser("guessRepositoryConfiguration");
        try {
            return await this.configurationService.guessRepositoryConfiguration(ctx, user, cloneUrl);
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }
            throw error;
        }
    }

    public async guessProjectConfiguration(ctx: TraceContext, projectId: string): Promise<string | undefined> {
        traceAPIParams(ctx, { projectId });
        const user = this.checkUser("guessProjectConfiguration");
        await this.guardProjectOperation(user, projectId, "get");

        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new Error("Project not found");
        }

        try {
            return await this.configurationService.guessRepositoryConfiguration(ctx, user, project.cloneUrl);
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }
            throw error;
        }
    }

    public async setProjectConfiguration(ctx: TraceContext, projectId: string, configString: string): Promise<void> {
        traceAPIParams(ctx, { projectId }); // filter configString because of size

        const user = this.checkAndBlockUser("setProjectConfiguration");
        await this.guardProjectOperation(user, projectId, "update");

        const parseResult = this.gitpodParser.parse(configString);
        if (parseResult.validationErrors) {
            throw new Error(`This configuration could not be parsed: ${parseResult.validationErrors.join(', ')}`);
        }
        await this.projectsService.updateProjectPartial({
            id: projectId,
            config: { '.gitpod.yml': configString },
        });
    }

    public async updateProjectPartial(ctx: TraceContext, partialProject: PartialProject): Promise<void> {
        traceAPIParams(ctx, {
            // censor everything irrelevant
            partialProject: {
                id: partialProject.id,
                settings: partialProject.settings,
            }
        });

        const user = this.checkUser("updateProjectPartial");
        await this.guardProjectOperation(user, partialProject.id, "update");

        const partial: PartialProject = { id: partialProject.id };
        const allowedFields: (keyof Project)[] = ['settings']; // Don't add 'config' here! Please use `setProjectConfiguration` instead to parse & validate configs
        for (const f of allowedFields) {
            if (f in partialProject) {
                (partial[f] as any) = partialProject[f];
            }
        }
        await this.projectsService.updateProjectPartial(partial);
    }

    public async getContentBlobUploadUrl(ctx: TraceContext, name: string): Promise<string> {
        traceAPIParams(ctx, { name });

        const user = this.checkAndBlockUser("getContentBlobUploadUrl");
        await this.guardAccess({ kind: "contentBlob", name: name, userID: user.id }, "create");

        const uploadUrlRequest = new UploadUrlRequest();
        uploadUrlRequest.setName(name);
        uploadUrlRequest.setOwnerId(user.id);

        const uploadUrlPromise = new Promise<UploadUrlResponse>((resolve, reject) => {
            const client = this.blobServiceClientProvider.getDefault();
            client.uploadUrl(uploadUrlRequest, (err: any, resp: UploadUrlResponse) => {
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

    public async getContentBlobDownloadUrl(ctx: TraceContext, name: string): Promise<string> {
        traceAPIParams(ctx, { name });

        const user = this.checkAndBlockUser("getContentBlobDownloadUrl");
        await this.guardAccess({ kind: "contentBlob", name: name, userID: user.id }, "get");

        const downloadUrlRequest = new DownloadUrlRequest();
        downloadUrlRequest.setName(name);
        downloadUrlRequest.setOwnerId(user.id);

        const downloadUrlPromise = new Promise<DownloadUrlResponse>((resolve, reject) => {
            const client = this.blobServiceClientProvider.getDefault();
            client.downloadUrl(downloadUrlRequest, (err: any, resp: DownloadUrlResponse) => {
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

    public async getGitpodTokens(ctx: TraceContext): Promise<GitpodToken[]> {
        const user = this.checkAndBlockUser("getGitpodTokens");
        const res = (await this.userDB.findAllGitpodTokensOfUser(user.id)).filter(v => !v.deleted);
        await Promise.all(res.map(tkn => this.guardAccess({ kind: "gitpodToken", subject: tkn }, "get")));
        return res;
    }

    public async generateNewGitpodToken(ctx: TraceContext, options: { name?: string, type: GitpodTokenType, scopes?: string[] }): Promise<string> {
        traceAPIParams(ctx, { options });

        const user = this.checkAndBlockUser("generateNewGitpodToken");
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

    public async getGitpodTokenScopes(ctx: TraceContext, tokenHash: string): Promise<string[]> {
        traceAPIParams(ctx, {});   // do not trace tokenHash

        const user = this.checkAndBlockUser("getGitpodTokenScopes");
        let token: GitpodToken | undefined;
        try {
            token = await this.userDB.findGitpodTokensOfUser(user.id, tokenHash);
        } catch (error) {
            log.error({ userId: user.id }, "failed to resolve gitpod token: ", error);
            return [];
        }
        if (!token || token.deleted) {
            return [];
        }
        await this.guardAccess({ kind: "gitpodToken", subject: token }, "get");
        return token.scopes;
    }

    public async deleteGitpodToken(ctx: TraceContext, tokenHash: string): Promise<void> {
        traceAPIParams(ctx, {});   // do not trace tokenHash

        const user = this.checkAndBlockUser("deleteGitpodToken");
        const existingTokens = await this.getGitpodTokens(ctx); // all tokens for logged in user
        const tkn = existingTokens.find(token => token.tokenHash === tokenHash);
        if (!tkn) {
            throw new Error(`User ${user.id} tries to delete a token ${tokenHash} that does not exist.`);
        }
        await this.guardAccess({ kind: "gitpodToken", subject: tkn }, "delete");
        return this.userDB.deleteGitpodToken(tokenHash);
    }

    public async hasPermission(ctx: TraceContext, permission: PermissionName): Promise<boolean> {
        traceAPIParams(ctx, { permission });

        const user = this.checkUser("hasPermission");
        return this.authorizationService.hasPermission(user, permission);
    }

    preparePluginUpload(ctx: TraceContext, params: PreparePluginUploadParams): Promise<string> {
        traceAPIParams(ctx, { params });

        const user = this.checkUser("preparePluginUpload");
        return this.pluginService.preparePluginUpload(params, user.id);
    }

    async resolvePlugins(ctx: TraceContext, workspaceId: string, params: ResolvePluginsParams): Promise<ResolvedPlugins> {
        traceAPIParams(ctx, {
            workspaceId,
            params: {
                ...censor(params, "config"),
                ...(params.config?.vscode ? {
                    config: {
                        vscode: params.config.vscode,
                    },
                } : {}),
            },
        }); // censor config because of size/potential PII, except of vscode parts
        traceWI(ctx, { workspaceId });

        this.checkUser("resolvePlugins")

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        const result = await this.pluginService.resolvePlugins(workspace.ownerId, params);
        return result.resolved;
    };

    installUserPlugins(ctx: TraceContext, params: InstallPluginsParams): Promise<boolean> {
        traceAPIParams(ctx, { params });

        const userId = this.checkUser("installUserPlugins").id;
        return this.pluginService.installUserPlugins(userId, params);
    }

    uninstallUserPlugin(ctx: TraceContext, params: UninstallPluginParams): Promise<boolean> {
        traceAPIParams(ctx, { params });

        const userId = this.checkUser("uninstallUserPlugin").id;
        return this.pluginService.uninstallUserPlugin(userId, params);
    }

    async guessGitTokenScopes(ctx: TraceContext, params: GuessGitTokenScopesParams): Promise<GuessedGitTokenScopes> {
        traceAPIParams(ctx, { params: censor(params, "currentToken") });

        const authProviders = await this.getAuthProviders(ctx);
        return this.gitTokenScopeGuesser.guessGitTokenScopes(authProviders.find(p => p.host == params.host), params);
    }

    async adminGetUsers(ctx: TraceContext, req: AdminGetListRequest<User>): Promise<AdminGetListResult<User>> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetUser(ctx: TraceContext, id: string): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminBlockUser(ctx: TraceContext, req: AdminBlockUserRequest): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminDeleteUser(ctx: TraceContext, _id: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminModifyRoleOrPermission(ctx: TraceContext, req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminModifyPermanentWorkspaceFeatureFlag(ctx: TraceContext, req: AdminModifyPermanentWorkspaceFeatureFlagRequest): Promise<User> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetWorkspaces(ctx: TraceContext, req: AdminGetWorkspacesRequest): Promise<AdminGetListResult<WorkspaceAndInstance>> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetWorkspace(ctx: TraceContext, id: string): Promise<WorkspaceAndInstance> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminForceStopWorkspace(ctx: TraceContext, id: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminRestoreSoftDeletedWorkspace(ctx: TraceContext, id: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetProjectsBySearchTerm(ctx: TraceContext, req: AdminGetListRequest<Project>): Promise<AdminGetListResult<Project>> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetProjectById(ctx: TraceContext, id: string): Promise<Project | undefined> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetTeamById(ctx: TraceContext, id: string): Promise<Team | undefined> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminFindPrebuilds(ctx: TraceContext, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminSetLicense(ctx: TraceContext, key: string): Promise<void> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Admin support is implemented in Gitpod's Enterprise Edition`);
    }

    async adminGetSettings(ctx: TraceContext): Promise<InstallationAdminSettings> {
        traceAPIParams(ctx, {});

        await this.guardAdminAccess("adminGetSettings", {}, Permission.ADMIN_API);

        const settings = await this.installationAdminDb.getData();

        return settings.settings;
    }

    async adminUpdateSettings(ctx: TraceContext, settings: InstallationAdminSettings): Promise<void> {
        traceAPIParams(ctx, {});

        await this.guardAdminAccess("adminUpdateSettings", {}, Permission.ADMIN_API);

        const newSettings: Partial<InstallationAdminSettings> = {};

        for (const p of InstallationAdminSettings.fields()) {
            if (p in settings) {
                newSettings[p] = settings[p];
            }
        }

        await this.installationAdminDb.setSettings(newSettings);
    }

    async getLicenseInfo(): Promise<GetLicenseInfoResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Licensing is implemented in Gitpod's Enterprise Edition`);
    }

    async licenseIncludesFeature(ctx: TraceContext, feature: LicenseFeature): Promise<boolean> {
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

    async validateLicense(ctx: TraceContext): Promise<LicenseValidationResult> {
        throw new ResponseError(ErrorCodes.EE_FEATURE, `Licensing is implemented in Gitpod's Enterprise Edition`);
    }

    async getOwnAuthProviders(ctx: TraceContext): Promise<AuthProviderEntry[]> {
        const redacted = (entry: AuthProviderEntry) => AuthProviderEntry.redact(entry);
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

    async updateOwnAuthProvider(ctx: TraceContext, { entry }: GitpodServer.UpdateOwnAuthProviderParams): Promise<AuthProviderEntry> {
        traceAPIParams(ctx, {});  // entry contains PII

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
                    const builtInExists = hostContext.authProvider.params.ownerId === undefined;
                    log.debug(`Attempt to override existing auth provider.`, { entry, safeProvider, builtInExists });
                    throw new Error("Provider for this host already exists.");
                }
            }
            const result = await this.authProviderService.updateAuthProvider(safeProvider);
            return AuthProviderEntry.redact(result)
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
            clientId: entry.clientId,
            clientSecret: entry.clientSecret,
            ownerId: entry.ownerId,
        }
        return safeEntry;
    }

    async deleteOwnAuthProvider(ctx: TraceContext, params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void> {
        traceAPIParams(ctx, { params });

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

    public async trackEvent(ctx: TraceContext, event: RemoteTrackMessage): Promise<void> {
        // Beware: DO NOT just event... the message, but consume it individually as the message is coming from
        //         the wire and we have no idea what's in it. Even passing the context and properties directly
        //         is questionable. Considering we're handing down the msg and do not know how the analytics library
        //         handles potentially broken or malicious input, we better err on the side of caution.
        const msg = {
            event: event.event,
            messageId: event.messageId,
            context: event.context,
            properties: event.properties
        }

        //either the user is authenticated...
        if (this.user) {
            const trackMessage: TrackMessage = {
                userId: this.user.id,
                ...msg
            }
            this.analytics.track(trackMessage);
            return;
        }

        //... or an anonymous id was passed. else, no tracking call is made
        if (event.anonymousId) {
            const trackMessage: TrackMessage = {
                anonymousId: event.anonymousId,
                ...msg
            }
            this.analytics.track(trackMessage);
        };
    }

    public async trackLocation(ctx: TraceContext, event: RemotePageMessage): Promise<void> {
        //either an anonymousId was passed, signifying that we want to make a privacy preserving page call...
        if (event.anonymousId) {
            // we are making a reduced page call that respects user's privacy by not using any PII
            this.analytics.page({
                anonymousId: event.anonymousId,
                messageId: event.messageId,
                context: {},
                properties: event.properties
            });
            return;
        }

        //...or we associate the page call with the authenticated user. else no page call is made.
        if (this.user) {
            const msg: PageMessage = {
                userId: this.user.id,
                messageId: event.messageId,
                context: {
                    ip: this.clientHeaderFields?.ip,
                    userAgent: this.clientHeaderFields?.userAgent
                },
                properties: event.properties,
            }
            this.analytics.page(msg);
        }
    }

    public async identifyUser(ctx: TraceContext, event: RemoteIdentifyMessage): Promise<void> {
        // traceAPIParams(ctx, { event }); tracing analytics does not make much sense

        //Identify calls collect user informmation. If the user is unknown, we don't make a call (privacy preservation)
        const user = this.checkUser("IdentifyUser");

        const msg: IdentifyMessage = {
            userId: user.id,
            traits: event.traits,
            context: event.context
        };
        this.analytics.identify(msg);
    }

    async getTerms(ctx: TraceContext): Promise<Terms> {
        // Terms are publicly available, thus no user check here.

        return this.termsProvider.getCurrent();
    }

    async getIDEOptions(ctx: TraceContext): Promise<IDEOptions> {
        const ideConfig = await this.ideConfigService.config;
        return ideConfig.ideOptions;
    }

    //#region gitpod.io concerns
    //
    async adminGetAccountStatement(ctx: TraceContext, userId: string): Promise<AccountStatement> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async adminSetProfessionalOpenSource(ctx: TraceContext, userId: string, shouldGetProfOSS: boolean): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async adminIsStudent(ctx: TraceContext, userId: string): Promise<boolean> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async adminAddStudentEmailDomain(ctx: TraceContext, userId: string, domain: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async adminGrantExtraHours(ctx: TraceContext, userId: string, extraHours: number): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async isStudent(ctx: TraceContext): Promise<boolean> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async getAccountStatement(ctx: TraceContext, options: GitpodServer.GetAccountStatementOptions): Promise<AccountStatement | undefined> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async getRemainingUsageHours(ctx: TraceContext): Promise<number> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async getChargebeeSiteId(ctx: TraceContext): Promise<string> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async createPortalSession(ctx: TraceContext): Promise<{}> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async checkout(ctx: TraceContext, planId: string, planQuantity?: number): Promise<{}> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async getAvailableCoupons(ctx: TraceContext): Promise<PlanCoupon[]> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async getAppliedCoupons(ctx: TraceContext): Promise<PlanCoupon[]> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async getShowPaymentUI(ctx: TraceContext): Promise<boolean> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async isChargebeeCustomer(ctx: TraceContext): Promise<boolean> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async subscriptionUpgradeTo(ctx: TraceContext, subscriptionId: string, chargebeePlanId: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async subscriptionDowngradeTo(ctx: TraceContext, subscriptionId: string, chargebeePlanId: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async subscriptionCancel(ctx: TraceContext, subscriptionId: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async subscriptionCancelDowngrade(ctx: TraceContext, subscriptionId: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsGet(ctx: TraceContext): Promise<TeamSubscription[]> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsGetSlots(ctx: TraceContext): Promise<TeamSubscriptionSlotResolved[]> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsGetUnassignedSlot(ctx: TraceContext, teamSubscriptionId: string): Promise<TeamSubscriptionSlot | undefined> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsAddSlots(ctx: TraceContext, teamSubscriptionId: string, quantity: number): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsAssignSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string, identityStr: string | undefined): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsReassignSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string, newIdentityStr: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsDeactivateSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async tsReactivateSlot(ctx: TraceContext, teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    async getGithubUpgradeUrls(ctx: TraceContext): Promise<GithubUpgradeURL[]> {
        throw new ResponseError(ErrorCodes.SAAS_FEATURE, `Not implemented in this version`);
    }
    //
    //#endregion

}

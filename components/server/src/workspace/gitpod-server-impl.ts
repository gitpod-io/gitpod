/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AppInstallationDB,
    UserDB,
    WorkspaceDB,
    DBWithTracing,
    TracedWorkspaceDB,
    DBGitpodToken,
    UserStorageResourcesDB,
    EmailDomainFilterDB,
    TeamDB,
} from "@gitpod/gitpod-db/lib";
import { BlockedRepositoryDB } from "@gitpod/gitpod-db/lib/blocked-repository-db";
import {
    AuthProviderEntry,
    AuthProviderInfo,
    CommitContext,
    Configuration,
    DisposableCollection,
    GetWorkspaceTimeoutResult,
    GitpodClient as GitpodApiClient,
    GitpodServer,
    GitpodToken,
    GitpodTokenType,
    PermissionName,
    PortVisibility,
    PrebuiltWorkspace,
    PrebuiltWorkspaceContext,
    SetWorkspaceTimeoutResult,
    StartPrebuildContext,
    StartWorkspaceResult,
    Token,
    User,
    UserEnvVar,
    UserEnvVarValue,
    UserInfo,
    WhitelistedRepository,
    Workspace,
    WorkspaceContext,
    WorkspaceCreationResult,
    WorkspaceImageBuild,
    WorkspaceInfo,
    WorkspaceInstance,
    WorkspaceInstancePort,
    WorkspaceInstanceUser,
    WorkspaceTimeoutDuration,
    GuessGitTokenScopesParams,
    GuessedGitTokenScopes,
    Team,
    TeamMemberInfo,
    TeamMembershipInvite,
    CreateProjectParams,
    Project,
    ProviderRepository,
    TeamMemberRole,
    WithDefaultConfig,
    FindPrebuildsParams,
    PrebuildWithStatus,
    StartPrebuildResult,
    ClientHeaderFields,
    Permission,
    SnapshotContext,
    SSHPublicKeyValue,
    UserSSHPublicKeyValue,
    PrebuildEvent,
    RoleOrPermission,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    PortProtocol,
} from "@gitpod/gitpod-protocol";
import { BlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import {
    AdminBlockUserRequest,
    AdminGetListRequest,
    AdminGetListResult,
    AdminGetWorkspacesRequest,
    AdminModifyPermanentWorkspaceFeatureFlagRequest,
    AdminModifyRoleOrPermissionRequest,
    WorkspaceAndInstance,
} from "@gitpod/gitpod-protocol/lib/admin-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Cancelable } from "@gitpod/gitpod-protocol/lib/util/cancelable";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    InterfaceWithTraceContext,
    TraceContext,
    TraceContextWithSpan,
} from "@gitpod/gitpod-protocol/lib/util/tracing";
import {
    IdentifyMessage,
    RemoteIdentifyMessage,
    RemotePageMessage,
    RemoteTrackMessage,
} from "@gitpod/gitpod-protocol/lib/analytics";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import {
    AdmissionLevel,
    ControlAdmissionRequest,
    ControlPortRequest,
    DescribeWorkspaceRequest,
    MarkActiveRequest,
    PortSpec,
    PortVisibility as ProtoPortVisibility,
    SetTimeoutRequest,
    PortProtocol as ProtoPortProtocol,
    StopWorkspacePolicy,
    TakeSnapshotRequest,
    UpdateSSHKeyRequest,
} from "@gitpod/ws-manager/lib/core_pb";
import * as crypto from "crypto";
import { inject, injectable } from "inversify";
import { URL } from "url";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { Disposable } from "vscode-jsonrpc";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { AuthProviderService } from "../auth/auth-provider-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { GuardedResource, ResourceAccessGuard, ResourceAccessOp } from "../auth/resource-access";
import { Config } from "../config";
import { NotFoundError, UnauthorizedError } from "../errors";
import { RepoURL } from "../repohost/repo-url";
import { AuthorizationService } from "../user/authorization-service";
import { TokenProvider } from "../user/token-provider";
import { UserDeletionService } from "../user/user-deletion-service";
import { UserService } from "../user/user-service";
import { ContextParser } from "./context-parser-service";
import { GitTokenScopeGuesser } from "./git-token-scope-guesser";
import { WorkspaceDeletionService } from "./workspace-deletion-service";
import { WorkspaceFactory } from "./workspace-factory";
import { WorkspaceStarter, isClusterMaintenanceError } from "./workspace-starter";
import { HeadlessLogUrls } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { HeadlessLogService, HeadlessLogEndpoint } from "./headless-log-service";
import { ConfigProvider, InvalidGitpodYMLError } from "./config-provider";
import { ProjectsService } from "../projects/projects-service";
import { IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import {
    PartialProject,
    OrganizationSettings,
    Organization,
} from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { ClientMetadata, traceClientMetadata } from "../websocket/websocket-connection-manager";
import {
    AdditionalUserData,
    EmailDomainFilterEntry,
    EnvVarWithValue,
    LinkedInProfile,
    OpenPrebuildContext,
    ProjectEnvVar,
    UserFeatureSettings,
    WorkspaceTimeoutSetting,
} from "@gitpod/gitpod-protocol/lib/protocol";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import { VerificationService } from "../auth/verification-service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { EntitlementService, MayStartWorkspaceResult } from "../billing/entitlement-service";
import { formatPhoneNumber } from "../user/phone-numbers";
import { IDEService } from "../ide-service";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import * as grpc from "@grpc/grpc-js";
import { CostCenterJSON } from "@gitpod/gitpod-protocol/lib/usage";
import { createCookielessId, maskIp } from "../analytics";
import {
    ConfigCatClientFactory,
    getExperimentsClientForBackend,
} from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { increaseDashboardErrorBoundaryCounter, reportCentralizedPermsValidation } from "../prometheus-metrics";
import { RegionService } from "./region-service";
import { isWorkspaceRegion, WorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { EnvVarService } from "./env-var-service";
import { LinkedInService } from "../linkedin-service";
import { SnapshotService, WaitForSnapshotOptions } from "./snapshot-service";
import { IncrementalPrebuildsService } from "../prebuilds/incremental-prebuilds-service";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { GitHubAppSupport } from "../github/github-app-support";
import { GitLabAppSupport } from "../gitlab/gitlab-app-support";
import { BitbucketAppSupport } from "../bitbucket/bitbucket-app-support";
import { StripeService } from "../billing/stripe-service";
import {
    BillingServiceClient,
    BillingServiceDefinition,
    StripeCustomer,
} from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { ClientError } from "nice-grpc-common";
import { BillingModes } from "../billing/billing-mode";
import { goDurationToHumanReadable } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { OrganizationPermission } from "../authorization/definitions";
import { Authorizer } from "../authorization/authorizer";
import { OrganizationService } from "../orgs/organization-service";
import { RedisSubscriber } from "../messaging/redis-subscriber";
import { UsageService } from "../orgs/usage-service";

// shortcut
export const traceWI = (ctx: TraceContext, wi: Omit<LogContext, "userId">) => TraceContext.setOWI(ctx, wi); // userId is already taken care of in WebsocketConnectionManager
export const traceAPIParams = (ctx: TraceContext, params: { [key: string]: any }) =>
    TraceContext.addJsonRPCParameters(ctx, params);
export function censor<T>(obj: T, k: keyof T): T {
    const r = { ...obj };
    delete (r as any)[k];
    return r;
}

export type GitpodServerWithTracing = InterfaceWithTraceContext<GitpodServer>;

@injectable()
export class GitpodServerImpl implements GitpodServerWithTracing, Disposable {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(TracedWorkspaceDB) private readonly workspaceDb: DBWithTracing<WorkspaceDB>,
        @inject(WorkspaceFactory) private readonly workspaceFactory: WorkspaceFactory,
        @inject(WorkspaceDeletionService) private readonly workspaceDeletionService: WorkspaceDeletionService,
        @inject(ContextParser) private contextParser: ContextParser,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,

        @inject(GitHubAppSupport) private readonly githubAppSupport: GitHubAppSupport,
        @inject(GitLabAppSupport) private readonly gitLabAppSupport: GitLabAppSupport,
        @inject(BitbucketAppSupport) private readonly bitbucketAppSupport: BitbucketAppSupport,

        @inject(PrebuildManager) private readonly prebuildManager: PrebuildManager,
        @inject(IncrementalPrebuildsService) private readonly incrementalPrebuildsService: IncrementalPrebuildsService,
        @inject(ConfigProvider) private readonly configProvider: ConfigProvider,
        @inject(WorkspaceStarter) private readonly workspaceStarter: WorkspaceStarter,
        @inject(SnapshotService) private readonly snapshotService: SnapshotService,
        @inject(WorkspaceManagerClientProvider)
        private readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider,

        @inject(UserDB) private readonly userDB: UserDB,
        @inject(BlockedRepositoryDB) private readonly blockedRepostoryDB: BlockedRepositoryDB,
        @inject(TokenProvider) private readonly tokenProvider: TokenProvider,
        @inject(UserService) private readonly userService: UserService,
        @inject(UserStorageResourcesDB) private readonly userStorageResourcesDB: UserStorageResourcesDB,
        @inject(UserDeletionService) private readonly userDeletionService: UserDeletionService,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(AuthorizationService) private readonly authorizationService: AuthorizationService,

        @inject(TeamDB) private readonly teamDB: TeamDB,
        @inject(OrganizationService) private readonly organizationService: OrganizationService,

        @inject(LinkedInService) private readonly linkedInService: LinkedInService,

        @inject(AppInstallationDB) private readonly appInstallationDB: AppInstallationDB,

        @inject(AuthProviderService) private readonly authProviderService: AuthProviderService,

        @inject(GitTokenScopeGuesser) private readonly gitTokenScopeGuesser: GitTokenScopeGuesser,

        @inject(HeadlessLogService) private readonly headlessLogService: HeadlessLogService,

        @inject(ProjectsService) private readonly projectsService: ProjectsService,

        @inject(IDEService) private readonly ideService: IDEService,

        @inject(VerificationService) private readonly verificationService: VerificationService,
        @inject(EntitlementService) private readonly entitlementService: EntitlementService,

        @inject(ConfigCatClientFactory) private readonly configCatClientFactory: ConfigCatClientFactory,

        @inject(Authorizer) private readonly auth: Authorizer,

        @inject(BillingModes) private readonly billingModes: BillingModes,
        @inject(StripeService) private readonly stripeService: StripeService,
        @inject(UsageService) private readonly usageService: UsageService,
        @inject(BillingServiceDefinition.name) private readonly billingService: BillingServiceClient,
        @inject(EmailDomainFilterDB) private emailDomainFilterdb: EmailDomainFilterDB,

        @inject(EnvVarService) private readonly envVarService: EnvVarService,
        @inject(RedisSubscriber) private readonly subscriber: RedisSubscriber,
    ) {}

    /** Id the uniquely identifies this server instance */
    public readonly uuid: string = uuidv4();
    public readonly clientMetadata: ClientMetadata;
    private clientHeaderFields: ClientHeaderFields;
    private resourceAccessGuard: ResourceAccessGuard;
    private client: GitpodApiClient | undefined;

    private userID: string | undefined;

    private readonly disposables = new DisposableCollection();

    dispose(): void {
        this.disposables.dispose();
    }

    initialize(
        client: GitpodApiClient | undefined,
        userID: string | undefined,
        accessGuard: ResourceAccessGuard,
        clientMetadata: ClientMetadata,
        connectionCtx: TraceContext | undefined,
        clientHeaderFields: ClientHeaderFields,
    ): void {
        if (client) {
            this.disposables.push(Disposable.create(() => (this.client = undefined)));
        }
        this.client = client;
        this.userID = userID;
        this.resourceAccessGuard = accessGuard;
        this.clientHeaderFields = clientHeaderFields;
        (this.clientMetadata as any) = clientMetadata;

        log.debug({ userId: this.userID }, `clientRegion: ${clientHeaderFields.clientRegion}`);
        log.debug({ userId: this.userID }, "initializeClient");

        this.listenForWorkspaceInstanceUpdates();

        this.listenForPrebuildUpdates().catch((err) => log.error("error registering for prebuild updates", err));
    }

    private async listenForPrebuildUpdates() {
        // 'registering for prebuild updates for all projects this user has access to
        const projects = await this.getAccessibleProjects();

        const handler = (ctx: TraceContext, update: PrebuildWithStatus) =>
            TraceContext.withSpan(
                "forwardPrebuildUpdateToClient",
                (ctx) => {
                    traceClientMetadata(ctx, this.clientMetadata);
                    TraceContext.setJsonRPCMetadata(ctx, "onPrebuildUpdate");

                    this.client?.onPrebuildUpdate(update);
                },
                ctx,
            );

        for (const projectId of projects) {
            this.disposables.pushAll([this.subscriber.listenForPrebuildUpdates(projectId, handler)]);
        }

        // TODO(at) we need to keep the list of accessible project up to date
    }

    private async getAccessibleProjects() {
        if (!this.userID) {
            return [];
        }

        // update all project this user has access to
        const allProjects: string[] = [];
        const teams = await this.organizationService.listOrganizationsByMember(this.userID, this.userID);
        for (const team of teams) {
            allProjects.push(...(await this.projectsService.getProjects(this.userID, team.id)).map((p) => p.id));
        }
        return allProjects;
    }

    private async findPrebuiltWorkspace(
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
                if (!!ws && !!wsi && ws.ownerId !== this.userID) {
                    const resetListenerFromRedis = this.subscriber.listenForWorkspaceInstanceUpdates(
                        ws.ownerId,
                        (ctx, instance) => {
                            if (instance.id === wsi.id) {
                                this.forwardInstanceUpdateToClient(ctx, instance);
                                if (instance.status.phase === "stopped") {
                                    resetListenerFromRedis.dispose();
                                }
                            }
                        },
                    );
                    this.disposables.push(resetListenerFromRedis);
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

    private listenForWorkspaceInstanceUpdates(): void {
        if (!this.userID || !this.client) {
            return;
        }

        // TODO(cw): the instance update is not subject to resource access guards, hence provides instance info
        //           to clients who might not otherwise have access to that information.
        this.disposables.pushAll([
            this.subscriber.listenForWorkspaceInstanceUpdates(this.userID, (ctx, instance) =>
                this.forwardInstanceUpdateToClient(ctx, instance),
            ),
        ]);
    }

    private forwardInstanceUpdateToClient(ctx: TraceContext, instance: WorkspaceInstance) {
        // gpl: We decided against tracing updates here, because it create far too much noise (cmp. history)
        this.client?.onInstanceUpdate(this.censorInstance(instance));
    }

    setClient(ctx: TraceContext, client: GitpodApiClient | undefined): void {
        throw new Error("Unsupported operation. Use initialize.");
    }

    private async guardAccess(resource: GuardedResource, op: ResourceAccessOp) {
        if (!(await this.resourceAccessGuard.canAccess(resource, op))) {
            throw new ApplicationError(
                ErrorCodes.PERMISSION_DENIED,
                `operation not permitted: missing ${op} permission on ${resource.kind}`,
            );
        }
    }

    /**
     * We don't need to/want to publish all internal details we maintain about a workspace instance.
     * This function removes instance details we do not want to share with the dashboard/Theia/potential attackers.
     *
     * @param wsi the workspace instance shape we want to censor
     */
    private censorInstance<T extends WorkspaceInstance | undefined>(wsi: T): T {
        if (!wsi) {
            return wsi;
        }

        const res = { ...wsi! };

        // owner token will set as cookie in the future
        delete res.status.ownerToken;
        // is an operational internal detail
        delete res.status.nodeName;
        // internal operation detail
        // @ts-ignore
        delete res.workspaceImage;

        return res;
    }

    private async checkUser(methodName?: string, logPayload?: {}, ctx?: LogContext): Promise<User> {
        // Generally, a user session is required.
        if (!this.userID) {
            throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "User is not authenticated. Please login.");
        }

        const user = await this.userDB.findUserById(this.userID);
        if (!user) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "User does not exist.");
        }

        if (user.markedDeleted === true) {
            throw new ApplicationError(ErrorCodes.USER_DELETED, "User has been deleted.");
        }
        const userContext: LogContext = {
            ...ctx,
            userId: user.id,
        };
        if (methodName) {
            let payload = { api: true };
            if (logPayload) {
                payload = { ...logPayload, ...payload };
            }
            log.debug(userContext, methodName, payload);
        }

        return user;
    }

    private async checkAndBlockUser(methodName?: string, logPayload?: {}, ctx?: LogContext): Promise<User> {
        const user = await this.checkUser(methodName, logPayload);
        if (user.blocked) {
            const userContext: LogContext = {
                ...ctx,
                userId: user.id,
            };
            let payload = { api: true };
            if (logPayload) {
                payload = { ...logPayload, ...payload };
            }
            log.debug(userContext, `${methodName || "checkAndBlockUser"}: blocked`, payload);
            throw new ApplicationError(ErrorCodes.USER_BLOCKED, "You've been blocked.");
        }
        return user;
    }

    public async getLoggedInUser(ctx: TraceContext): Promise<User> {
        return this.checkUser("getLoggedInUser");
    }

    public async updateLoggedInUser(ctx: TraceContext, update: Partial<User>): Promise<User> {
        traceAPIParams(ctx, {}); // partialUser contains PII

        const user = await this.checkUser("updateLoggedInUser");
        await this.guardAccess({ kind: "user", subject: user }, "update");

        //hang on to user profile before it's overwritten for analytics below
        const oldProfile = User.getProfile(user);

        const updatedUser = await this.userService.updateUser(user.id, update);

        //track event and user profile if profile of partialUser changed
        const newProfile = User.getProfile(updatedUser);
        if (User.Profile.hasChanges(oldProfile, newProfile)) {
            this.analytics.track({
                userId: user.id,
                event: "profile_changed",
                properties: { new: newProfile, old: oldProfile },
            });
            this.analytics.identify({
                userId: user.id,
                traits: { email: newProfile.email, company: newProfile.company, name: newProfile.name },
            });
        }

        return updatedUser;
    }

    public async maySetTimeout(ctx: TraceContext): Promise<boolean> {
        const user = await this.checkUser("maySetTimeout");
        await this.guardAccess({ kind: "user", subject: user }, "get");

        return await this.entitlementService.maySetTimeout(user, new Date());
    }

    public async updateWorkspaceTimeoutSetting(
        ctx: TraceContext,
        setting: Partial<WorkspaceTimeoutSetting>,
    ): Promise<void> {
        traceAPIParams(ctx, { setting });
        if (setting.workspaceTimeout) {
            WorkspaceTimeoutDuration.validate(setting.workspaceTimeout);
        }

        const user = await this.checkAndBlockUser("updateWorkspaceTimeoutSetting");
        await this.guardAccess({ kind: "user", subject: user }, "update");

        if (!(await this.entitlementService.maySetTimeout(user, new Date()))) {
            throw new Error("configure workspace timeout only available for paid user.");
        }

        AdditionalUserData.set(user, setting);
        await this.userDB.updateUserPartial(user);
    }

    public async sendPhoneNumberVerificationToken(
        ctx: TraceContext,
        rawPhoneNumber: string,
    ): Promise<{ verificationId: string }> {
        const user = await this.checkUser("sendPhoneNumberVerificationToken");

        // Check if verify via call is enabled
        const phoneVerificationByCall = await this.configCatClientFactory().getValueAsync(
            "phoneVerificationByCall",
            false,
            {
                user,
            },
        );

        const channel = phoneVerificationByCall ? "call" : "sms";

        const { verification, verificationId } = await this.verificationService.sendVerificationToken(
            formatPhoneNumber(rawPhoneNumber),
            channel,
        );
        this.analytics.track({
            event: "phone_verification_sent",
            userId: user.id,
            properties: {
                verification_id: verificationId,
                channel: verification.channel,
                requested_channel: channel,
            },
        });

        return {
            verificationId,
        };
    }

    public async verifyPhoneNumberVerificationToken(
        ctx: TraceContext,
        rawPhoneNumber: string,
        token: string,
        verificationId: string,
    ): Promise<boolean> {
        const phoneNumber = formatPhoneNumber(rawPhoneNumber);
        const user = await this.checkUser("verifyPhoneNumberVerificationToken");

        const { verified, channel } = await this.verificationService.verifyVerificationToken(
            phoneNumber,
            token,
            verificationId,
        );
        if (!verified) {
            this.analytics.track({
                event: "phone_verification_failed",
                userId: user.id,
                properties: {
                    channel,
                    verification_id: verificationId,
                },
            });
            return false;
        }
        this.verificationService.markVerified(user);
        user.verificationPhoneNumber = phoneNumber;
        await this.userDB.updateUserPartial(user);
        this.analytics.track({
            event: "phone_verification_completed",
            userId: user.id,
            properties: {
                channel,
                verification_id: verificationId,
            },
        });
        return true;
    }

    public async getClientRegion(ctx: TraceContext): Promise<string | undefined> {
        await this.checkUser("getClientRegion");
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
        const authProviders = hostContexts.map((hc) => hc.authProvider.info);

        const isBuiltIn = (info: AuthProviderInfo) => !info.ownerId;
        const isNotHidden = (info: AuthProviderInfo) => !info.hiddenOnDashboard;
        const isVerified = (info: AuthProviderInfo) => info.verified;
        const isNotOrgProvider = (info: AuthProviderInfo) => !info.organizationId;

        // if no user session is available, compute public information only
        if (!this.userID) {
            const toPublic = (info: AuthProviderInfo) =>
                <AuthProviderInfo>{
                    authProviderId: info.authProviderId,
                    authProviderType: info.authProviderType,
                    disallowLogin: info.disallowLogin,
                    host: info.host,
                    icon: info.icon,
                    description: info.description,
                };
            let result = authProviders.filter(isNotHidden).filter(isVerified).filter(isNotOrgProvider);
            if (builtinAuthProvidersConfigured) {
                result = result.filter(isBuiltIn);
            }
            return result.map(toPublic);
        }

        const user = await this.checkUser("getAuthProviders");

        // otherwise show all the details
        const result: AuthProviderInfo[] = [];
        for (const info of authProviders) {
            const identity = user.identities.find((i) => i.authProviderId === info.authProviderId);
            if (identity) {
                result.push({ ...info, isReadonly: identity.readonly });
                continue;
            }
            if (info.ownerId === user.id) {
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
            isSingleOrgInstallation: this.config.isSingleOrgInstallation,
        };
    }

    public async getToken(ctx: TraceContext, query: GitpodServer.GetTokenSearchOptions): Promise<Token | undefined> {
        traceAPIParams(ctx, { query });

        const user = await this.checkUser("getToken");
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

    public async deleteAccount(ctx: TraceContext): Promise<void> {
        const user = await this.checkAndBlockUser("deleteAccount");
        await this.guardAccess({ kind: "user", subject: user! }, "delete");

        await this.userDeletionService.deleteUser(user.id);
    }

    private async getTeamMembersByProject(projectId: string | undefined): Promise<TeamMemberInfo[]> {
        const user = await this.checkUser("getTeamMembersByProject");
        if (projectId) {
            const project = await this.projectsService.getProject(user.id, projectId);
            if (project && project.teamId) {
                return await this.organizationService.listMembers(user.id, project.teamId);
            }
        }
        return [];
    }

    public async getWorkspace(ctx: TraceContext, workspaceId: string): Promise<WorkspaceInfo> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkUser("getWorkspace");

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        const latestInstancePromise = this.workspaceDb.trace(ctx).findCurrentInstance(workspaceId);
        const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
        await this.guardAccess({ kind: "workspace", subject: workspace, teamMembers }, "get");
        const latestInstance = await latestInstancePromise;
        if (!!latestInstance) {
            await this.guardAccess(
                {
                    kind: "workspaceInstance",
                    subject: latestInstance,
                    workspace,
                    teamMembers,
                },
                "get",
            );
        }

        return {
            workspace,
            latestInstance: this.censorInstance(latestInstance),
        };
    }

    public async getOwnerToken(ctx: TraceContext, workspaceId: string): Promise<string> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        await this.checkAndBlockUser("getOwnerToken");

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace) {
            throw new Error("owner token not found");
        }
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        const latestInstance = await this.workspaceDb.trace(ctx).findCurrentInstance(workspaceId);
        await this.guardAccess({ kind: "workspaceInstance", subject: latestInstance, workspace }, "get");

        const ownerToken = latestInstance?.status.ownerToken;
        if (!ownerToken) {
            throw new Error("owner token not found");
        }
        return ownerToken;
    }

    public async getIDECredentials(ctx: TraceContext, workspaceId: string): Promise<string> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("getIDECredentials");

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace) {
            throw new Error("workspace not found");
        }
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        if (workspace.config.ideCredentials) {
            return workspace.config.ideCredentials;
        }
        return this.workspaceDb.trace(ctx).transaction(async (db) => {
            const ws = await this.internalGetWorkspace(user, workspaceId, db);
            ws.config.ideCredentials = crypto.randomBytes(32).toString("base64");
            await db.store(ws);
            return ws.config.ideCredentials;
        });
    }

    public async startWorkspace(
        ctx: TraceContext,
        workspaceId: string,
        options: GitpodServer.StartWorkspaceOptions,
    ): Promise<StartWorkspaceResult> {
        traceAPIParams(ctx, { workspaceId, options });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("startWorkspace", undefined, { workspaceId });

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        const mayStartPromise = this.mayStartWorkspace(
            ctx,
            user,
            workspace.organizationId,
            this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id),
        );
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
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Workspace not found!");
        }

        // no matter if the workspace is shared or not, you cannot create a new instance
        await this.guardAccess({ kind: "workspaceInstance", subject: undefined, workspace }, "create");

        if (workspace.type !== "regular") {
            throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "Cannot (re-)start irregular workspace.");
        }

        if (workspace.deleted) {
            throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "Cannot (re-)start a deleted workspace.");
        }
        const envVarsPromise = this.envVarService.resolve(workspace);
        const projectPromise = workspace.projectId
            ? this.projectsService.getProject(user.id, workspace.projectId)
            : Promise.resolve(undefined);

        await mayStartPromise;

        options.region = await this.determineWorkspaceRegion(workspace, options.region || "");

        // at this point we're about to actually start a new workspace
        const result = await this.workspaceStarter.startWorkspace(
            ctx,
            workspace,
            user,
            await projectPromise,
            await envVarsPromise,
            options,
        );
        traceWI(ctx, { instanceId: result.instanceID });
        return result;
    }

    public async stopWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkUser("stopWorkspace", undefined, { workspaceId });
        const logCtx = { userId: user.id, workspaceId };

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        if (workspace.type === "prebuild") {
            // If this is a team prebuild, any team member can stop it.
            const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
            await this.guardAccess({ kind: "workspace", subject: workspace, teamMembers }, "get");
        } else {
            // If this is not a prebuild, or it's a personal prebuild, only the workspace owner can stop it.
            await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        }

        try {
            await this.internalStopWorkspace(ctx, workspace, "stopped via API");
        } catch (err) {
            log.error(logCtx, "stopWorkspace error: ", err);
            if (isClusterMaintenanceError(err)) {
                throw new ApplicationError(
                    ErrorCodes.PRECONDITION_FAILED,
                    "Cannot stop the workspace because the workspace cluster is under maintenance. Please try again in a few minutes",
                );
            }
            throw err;
        }
    }

    private async internalStopWorkspace(
        ctx: TraceContext,
        workspace: Workspace,
        reason: string,
        policy?: StopWorkspacePolicy,
        admin: boolean = false,
    ): Promise<void> {
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
            if (workspace.type === "prebuild") {
                // If this is a team prebuild, any team member can stop it.
                const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
                await this.guardAccess(
                    { kind: "workspaceInstance", subject: instance, workspace, teamMembers },
                    "update",
                );
            } else {
                // If this is not a prebuild, or it's a personal prebuild, only the workspace owner can stop it.
                await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace }, "update");
            }
        }

        await this.workspaceStarter.stopWorkspaceInstance(ctx, instance.id, instance.region, reason, policy);
    }

    private async guardAdminAccess(method: string, params: any, requiredPermission: PermissionName): Promise<User> {
        const user = await this.checkAndBlockUser(method);
        if (!this.authorizationService.hasPermission(user, requiredPermission)) {
            log.warn({ userId: user.id }, "unauthorised admin access", { authorised: false, method, params });
            throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }
        log.info({ userId: user.id }, "admin access", { authorised: true, method, params });
        return user;
    }

    public async updateWorkspaceUserPin(
        ctx: TraceContext,
        workspaceId: string,
        action: "pin" | "unpin" | "toggle",
    ): Promise<void> {
        traceAPIParams(ctx, { workspaceId, action });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("updateWorkspaceUserPin");

        await this.workspaceDb.trace(ctx).transaction(async (db) => {
            const ws = await this.internalGetWorkspace(user, workspaceId, db);
            await this.guardAccess({ kind: "workspace", subject: ws }, "update");

            switch (action) {
                case "pin":
                    ws.pinned = true;
                    break;
                case "unpin":
                    ws.pinned = false;
                    break;
                case "toggle":
                    ws.pinned = !ws.pinned;
                    break;
            }

            await db.store(ws);
        });
    }

    public async deleteWorkspace(ctx: TraceContext, workspaceId: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("deleteWorkspace");

        const ws = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: ws }, "delete");

        // for good measure, try and stop running instances
        await this.internalStopWorkspace(ctx, ws, "deleted via API");

        // actually delete the workspace
        await this.workspaceDeletionService.softDeleteWorkspace(ctx, ws, "user");
    }

    public async setWorkspaceDescription(ctx: TraceContext, workspaceId: string, description: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId, description });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("setWorkspaceDescription");

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));

        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");
        await this.workspaceDb.trace(ctx).updatePartial(workspaceId, { description });
    }

    public async getWorkspaces(
        ctx: TraceContext,
        options: GitpodServer.GetWorkspacesOptions,
    ): Promise<WorkspaceInfo[]> {
        traceAPIParams(ctx, { options });

        const user = await this.checkUser("getWorkspaces");

        const res = await this.workspaceDb.trace(ctx).find({
            limit: 20,
            ...options,
            userId: user.id,
            includeHeadless: false,
        });
        await Promise.all(res.map((ws) => this.guardAccess({ kind: "workspace", subject: ws.workspace }, "get")));
        await Promise.all(
            res.map((ws) =>
                this.guardAccess(
                    { kind: "workspaceInstance", subject: ws.latestInstance, workspace: ws.workspace },
                    "get",
                ),
            ),
        );
        return res;
    }

    public async isWorkspaceOwner(ctx: TraceContext, workspaceId: string): Promise<boolean> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkUser("isWorkspaceOwner", undefined, { workspaceId });

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        return user.id == workspace.ownerId;
    }

    public async sendHeartBeat(ctx: TraceContext, options: GitpodServer.SendHeartBeatOptions): Promise<void> {
        traceAPIParams(ctx, { options });
        const { instanceId } = options;
        traceWI(ctx, { instanceId });

        const user = await this.checkAndBlockUser("sendHeartBeat", undefined, { instanceId });

        try {
            const wsi = await this.workspaceDb.trace(ctx).findInstanceById(instanceId);
            if (!wsi) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, "workspace does not exist");
            }

            const ws = await this.workspaceDb.trace(ctx).findById(wsi.workspaceId);
            if (!ws) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, "workspace does not exist");
            }
            await this.guardAccess({ kind: "workspaceInstance", subject: wsi, workspace: ws }, "update");

            const wasClosed = !!(options && options.wasClosed);
            await this.workspaceDb.trace(ctx).updateLastHeartbeat(instanceId, user.id, new Date(), wasClosed);

            const req = new MarkActiveRequest();
            req.setId(instanceId);
            req.setClosed(wasClosed);

            const client = await this.workspaceManagerClientProvider.get(wsi.region);
            await client.markActive(ctx, req);
        } catch (e) {
            if (e.message && typeof e.message === "string" && (e.message as String).endsWith("does not exist")) {
                // This is an old tab with open workspace: drop silently
                return;
            } else {
                e = this.mapGrpcError(e);
                throw e;
            }
        }
    }

    async getWorkspaceOwner(ctx: TraceContext, workspaceId: string): Promise<UserInfo | undefined> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkUser("getWorkspaceOwner");

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
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

        const user = await this.checkAndBlockUser("getWorkspaceUsers", undefined, { workspaceId });

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        // Note: there's no need to try and guard the users below, they're not complete users but just enough to
        //       to support the workspace sharing. The access guard above is enough.
        return await this.workspaceDb
            .trace(ctx)
            .getWorkspaceUsers(workspaceId, this.config.workspaceHeartbeat.timeoutSeconds * 1000);
    }

    private async internalGetWorkspace(user: User, id: string, db: WorkspaceDB): Promise<Workspace> {
        const workspace = await db.findById(id);
        if (!workspace) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Workspace not found.");
        }
        return workspace;
    }

    private async findRunningInstancesForContext(
        ctx: TraceContext,
        contextPromise: Promise<WorkspaceContext>,
        contextUrl: string,
        runningInstancesPromise: Promise<WorkspaceInstance[]>,
    ): Promise<WorkspaceInfo[]> {
        const span = TraceContext.startSpan("findRunningInstancesForContext", ctx);
        try {
            const runningInstances = (await runningInstancesPromise).filter(
                (instance) => instance.status.phase !== "stopping",
            );
            const runningInfos = await Promise.all(
                runningInstances.map(async (workspaceInstance) => {
                    const workspace = await this.workspaceDb.trace(ctx).findById(workspaceInstance.workspaceId);
                    if (!workspace) {
                        return;
                    }

                    const result: WorkspaceInfo = {
                        workspace,
                        latestInstance: workspaceInstance,
                    };
                    return result;
                }),
            );

            let context: WorkspaceContext;
            try {
                context = await contextPromise;
            } catch {
                return [];
            }
            const sameContext = (ws: WorkspaceInfo) => {
                return (
                    ws.workspace.contextURL === contextUrl &&
                    CommitContext.is(ws.workspace.context) &&
                    CommitContext.is(context) &&
                    ws.workspace.context.revision === context.revision
                );
            };
            return runningInfos
                .filter((info) => info && info.workspace.type === "regular" && sameContext(info))
                .map((info) => info!);
        } catch (e) {
            TraceContext.setError(ctx, e);
            throw e;
        } finally {
            span.finish();
        }
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

    public async createWorkspace(
        ctx: TraceContext,
        options: GitpodServer.CreateWorkspaceOptions,
    ): Promise<WorkspaceCreationResult> {
        traceAPIParams(ctx, { options });

        const contextUrl = options.contextUrl;
        let normalizedContextUrl: string = "";
        let logContext: LogContext = {};

        try {
            const user = await this.checkAndBlockUser("createWorkspace", { options });

            logContext = { userId: user.id };

            //TODO(se) remove this implicit check and let instead clients do the checking.
            // Credit check runs in parallel with the other operations up until we start consuming resources.
            // Make sure to await for the creditCheck promise in the right places.
            const runningInstancesPromise = this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
            normalizedContextUrl = this.contextParser.normalizeContextURL(contextUrl);
            let runningForContextPromise: Promise<WorkspaceInfo[]> = Promise.resolve([]);
            const contextPromise = this.contextParser.handle(ctx, user, normalizedContextUrl);
            if (!options.ignoreRunningWorkspaceOnSameCommit) {
                runningForContextPromise = this.findRunningInstancesForContext(
                    ctx,
                    contextPromise,
                    normalizedContextUrl,
                    runningInstancesPromise,
                );
            }

            // make sure we've checked that the user has enough credit before consuming any resources.
            // Be sure to check this before prebuilds and create workspace, too!
            let context = await contextPromise;

            if (SnapshotContext.is(context)) {
                // TODO(janx): Remove snapshot access tracking once we're certain that enforcing repository read access doesn't disrupt the snapshot UX.
                this.trackEvent(ctx, {
                    event: "snapshot_access_request",
                    properties: { snapshot_id: context.snapshotId },
                }).catch((err) => log.error("cannot track event", err));
                const snapshot = await this.workspaceDb.trace(ctx).findSnapshotById(context.snapshotId);
                if (!snapshot) {
                    throw new ApplicationError(
                        ErrorCodes.NOT_FOUND,
                        "No snapshot with id '" + context.snapshotId + "' found.",
                    );
                }
                const workspace = await this.workspaceDb.trace(ctx).findById(snapshot.originalWorkspaceId);
                if (!workspace) {
                    throw new ApplicationError(
                        ErrorCodes.NOT_FOUND,
                        "No workspace with id '" + snapshot.originalWorkspaceId + "' found.",
                    );
                }
                try {
                    await this.guardAccess({ kind: "snapshot", subject: snapshot, workspace }, "get");
                } catch (error) {
                    this.trackEvent(ctx, {
                        event: "snapshot_access_denied",
                        properties: { snapshot_id: context.snapshotId, error: String(error) },
                    }).catch((err) => log.error("cannot track event", err));
                    if (UnauthorizedError.is(error)) {
                        throw error;
                    }
                    throw new ApplicationError(
                        ErrorCodes.PERMISSION_DENIED,
                        `Snapshot URLs require read access to the underlying repository. Please request access from the repository owner.`,
                    );
                }
                this.trackEvent(ctx, {
                    event: "snapshot_access_granted",
                    properties: { snapshot_id: context.snapshotId },
                }).catch((err) => log.error("cannot track event", err));
            }

            // if we're forced to use the default config, mark the context as such
            if (!!options.forceDefaultConfig) {
                context = WithDefaultConfig.mark(context);
            }

            // if this is an explicit prebuild, check if the user wants to install an app.
            if (
                StartPrebuildContext.is(context) &&
                CommitContext.is(context.actual) &&
                context.actual.repository.cloneUrl
            ) {
                const cloneUrl = context.actual.repository.cloneUrl;
                const host = new URL(cloneUrl).hostname;
                const hostContext = this.hostContextProvider.get(host);
                const services = hostContext && hostContext.services;
                if (!hostContext || !services) {
                    console.error("Unknown host: " + host);
                } else {
                    // on purpose to not await on that installation process, because it‘s not required of workspace start
                    // See https://github.com/gitpod-io/gitpod/pull/6420#issuecomment-953499632 for more detail
                    (async () => {
                        if (await services.repositoryService.canInstallAutomatedPrebuilds(user, cloneUrl)) {
                            console.log("Installing automated prebuilds for " + cloneUrl);
                            await services.repositoryService.installAutomatedPrebuilds(user, cloneUrl);
                        }
                    })().catch((e) => console.error("Install automated prebuilds failed", e));
                }
            }

            if (!options.ignoreRunningWorkspaceOnSameCommit && !context.forceCreateNewWorkspace) {
                const runningForContext = await runningForContextPromise;
                if (runningForContext.length > 0) {
                    return { existingWorkspaces: runningForContext };
                }
            }
            const project = CommitContext.is(context)
                ? (await this.projectsService.findProjectsByCloneUrl(user.id, context.repository.cloneUrl))[0]
                : undefined;

            const mayStartWorkspacePromise = this.mayStartWorkspace(
                ctx,
                user,
                options.organizationId,
                runningInstancesPromise,
            );

            // TODO (se) findPrebuiltWorkspace also needs the organizationId once we limit prebuild reuse to the same org
            const prebuiltWorkspace = await this.findPrebuiltWorkspace(
                ctx,
                user,
                context,
                options.ignoreRunningPrebuild,
                options.allowUsingPreviousPrebuilds || project?.settings?.allowUsingPreviousPrebuilds,
            );
            if (WorkspaceCreationResult.is(prebuiltWorkspace)) {
                ctx.span?.log({ prebuild: "running" });
                return prebuiltWorkspace as WorkspaceCreationResult;
            }
            if (WorkspaceContext.is(prebuiltWorkspace)) {
                ctx.span?.log({ prebuild: "available" });
                context = prebuiltWorkspace;
            }

            await mayStartWorkspacePromise;

            const workspace = await this.workspaceFactory.createForContext(
                ctx,
                user,
                options.organizationId,
                project,
                context,
                normalizedContextUrl,
            );
            try {
                await this.guardAccess({ kind: "workspace", subject: workspace }, "create");
            } catch (err) {
                await this.workspaceDeletionService.hardDeleteWorkspace(ctx, workspace.id);
                throw err;
            }

            const envVarsPromise = this.envVarService.resolve(workspace);
            options.region = await this.determineWorkspaceRegion(workspace, options.region || "");

            logContext.workspaceId = workspace.id;
            traceWI(ctx, { workspaceId: workspace.id });
            const startWorkspaceResult = await this.workspaceStarter.startWorkspace(
                ctx,
                workspace,
                user,
                project,
                await envVarsPromise,
                options,
            );
            ctx.span?.log({ event: "startWorkspaceComplete", ...startWorkspaceResult });

            return {
                workspaceURL: startWorkspaceResult.workspaceURL,
                createdWorkspaceId: workspace.id,
            };
        } catch (error) {
            this.handleError(error, logContext, normalizedContextUrl);
            throw error;
        }
    }

    public async resolveContext(ctx: TraceContextWithSpan, contextUrl: string): Promise<WorkspaceContext> {
        const user = await this.checkAndBlockUser("resolveContext");
        const normalizedCtxURL = this.contextParser.normalizeContextURL(contextUrl);
        try {
            return await this.contextParser.handle(ctx, user, normalizedCtxURL);
        } catch (error) {
            this.handleError(error, { userId: user.id }, normalizedCtxURL);
            throw error;
        }
    }

    private handleError(error: any, logContext: LogContext, normalizedContextUrl: string) {
        if (NotFoundError.is(error)) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Repository not found.", error.data);
        }
        if (UnauthorizedError.is(error)) {
            throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
        }
        if (InvalidGitpodYMLError.is(error)) {
            throw new ApplicationError(ErrorCodes.INVALID_GITPOD_YML, error.message);
        }

        const errorCode = this.parseErrorCode(error);
        if (errorCode) {
            // specific errors will be handled in create-workspace.tsx
            throw error;
        }
        log.debug(logContext, error);
        throw new ApplicationError(
            ErrorCodes.CONTEXT_PARSE_ERROR,
            error && error.message ? error.message : `Cannot create workspace for URL: ${normalizedContextUrl}`,
        );
    }

    // Projects
    async getProviderRepositoriesForUser(
        ctx: TraceContext,
        params: { provider: string; hints?: object },
    ): Promise<ProviderRepository[]> {
        traceAPIParams(ctx, { params });

        const user = await this.checkAndBlockUser("getProviderRepositoriesForUser");

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
        const projects = await this.projectsService.getProjectsByCloneUrls(
            user.id,
            repositories.map((r) => r.cloneUrl),
        );

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
        const user = await this.checkAndBlockUser("getPrebuildEvents");

        const project = await this.projectsService.getProject(user.id, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "get");

        const events = await this.projectsService.getPrebuildEvents(user.id, project.cloneUrl);
        return events;
    }

    async triggerPrebuild(
        ctx: TraceContext,
        projectId: string,
        branchName: string | null,
    ): Promise<StartPrebuildResult> {
        traceAPIParams(ctx, { projectId, branchName });

        const user = await this.checkAndBlockUser("triggerPrebuild");

        const project = await this.projectsService.getProject(user.id, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "update");

        const branchDetails = !!branchName
            ? await this.projectsService.getBranchDetails(user, project, branchName)
            : (await this.projectsService.getBranchDetails(user, project)).filter((b) => b.isDefault);
        if (branchDetails.length !== 1) {
            log.debug({ userId: user.id }, "Cannot find branch details.", { project, branchName });
            throw new ApplicationError(
                ErrorCodes.NOT_FOUND,
                `Could not find ${!branchName ? "a default branch" : `branch '${branchName}'`} in repository ${
                    project.cloneUrl
                }`,
            );
        }
        const contextURL = branchDetails[0].url;

        const context = (await this.contextParser.handle(ctx, user, contextURL)) as CommitContext;

        // HACK: treat manual triggered prebuild as a reset for the inactivity state
        await this.projectsService.markActive(user.id, project.id);

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

    private parseErrorCode(error: any) {
        const errorCode = error && error.code;
        if (errorCode) {
            try {
                const code = parseInt(errorCode);
                if (!isNaN(code)) {
                    return code;
                }
            } catch {}
        }
        return undefined;
    }

    private async pollDatabaseUntilPrebuildIsAvailable(
        ctx: TraceContext,
        prebuildID: string,
        timeoutMS: number,
    ): Promise<PrebuiltWorkspace | undefined> {
        const pollPrebuildAvailable = new Cancelable(async (cancel) => {
            const prebuild = await this.workspaceDb.trace(ctx).findPrebuildByID(prebuildID);
            if (prebuild && PrebuiltWorkspace.isAvailable(prebuild)) {
                return prebuild;
            }
            return;
        });

        const result = await Promise.race([
            pollPrebuildAvailable.run(),
            new Promise<undefined>((resolve, reject) => setTimeout(() => resolve(undefined), timeoutMS)),
        ]);
        pollPrebuildAvailable.cancel();

        return result;
    }

    private async mayStartWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<void> {
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
            throw new ApplicationError(ErrorCodes.NEEDS_VERIFICATION, `Please verify your account.`);
        }
        if (!!result.usageLimitReachedOnCostCenter) {
            throw new ApplicationError(
                ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED,
                "Increase usage limit and try again.",
                {
                    attributionId: result.usageLimitReachedOnCostCenter,
                },
            );
        }
        if (!!result.hitParallelWorkspaceLimit) {
            throw new ApplicationError(
                ErrorCodes.TOO_MANY_RUNNING_WORKSPACES,
                `You cannot run more than ${result.hitParallelWorkspaceLimit.max} workspaces at the same time. Please stop a workspace before starting another one.`,
            );
        }
    }

    public async getFeaturedRepositories(ctx: TraceContext): Promise<WhitelistedRepository[]> {
        const user = await this.checkAndBlockUser("getFeaturedRepositories");
        const repositories = await this.workspaceDb.trace(ctx).getFeaturedRepositories();
        if (repositories.length === 0) return [];

        return (
            await Promise.all(
                repositories
                    .filter((repo) => repo.url != undefined)
                    .map(async (whitelistedRepo) => {
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
                            };
                        } catch {
                            // this happens quite often if only GitLab is enabled
                        }
                    }),
            )
        ).filter((e) => e !== undefined) as WhitelistedRepository[];
    }

    public async getSuggestedContextURLs(ctx: TraceContext): Promise<string[]> {
        const user = await this.checkAndBlockUser("getSuggestedContextURLs");
        const suggestions: Array<{ url: string; lastUse?: string; priority: number }> = [];
        const logCtx: LogContext = { userId: user.id };

        // Fetch all data sources in parallel for maximum speed (don't await in this scope before `Promise.allSettled(promises)` below!)
        const promises = [];

        // Example repositories
        promises.push(
            this.getFeaturedRepositories(ctx)
                .then((exampleRepos) => {
                    exampleRepos.forEach((r) => suggestions.push({ url: r.url, priority: 0 }));
                })
                .catch((error) => {
                    log.error(logCtx, "Could not get example repositories", error);
                }),
        );

        // User repositories (from Apps)
        promises.push(
            this.getAuthProviders(ctx)
                .then((authProviders) =>
                    Promise.all(
                        authProviders.map(async (p) => {
                            try {
                                const userRepos = await this.getProviderRepositoriesForUser(ctx, { provider: p.host });
                                userRepos.forEach((r) =>
                                    suggestions.push({ url: r.cloneUrl.replace(/\.git$/, ""), priority: 5 }),
                                );
                            } catch (error) {
                                log.debug(logCtx, "Could not get user repositories from App for " + p.host, error);
                            }
                        }),
                    ),
                )
                .catch((error) => {
                    log.error(logCtx, "Could not get auth providers", error);
                }),
        );

        // User repositories (from Git hosts directly)
        promises.push(
            this.getAuthProviders(ctx)
                .then((authProviders) =>
                    Promise.all(
                        authProviders.map(async (p) => {
                            try {
                                const hostContext = this.hostContextProvider.get(p.host);
                                const services = hostContext?.services;
                                if (!services) {
                                    log.error(logCtx, "Unsupported repository host: " + p.host);
                                    return;
                                }
                                const userRepos = await services.repositoryProvider.getUserRepos(user);
                                userRepos.forEach((r) =>
                                    suggestions.push({ url: r.replace(/\.git$/, ""), priority: 5 }),
                                );
                            } catch (error) {
                                log.debug(logCtx, "Could not get user repositories from host " + p.host, error);
                            }
                        }),
                    ),
                )
                .catch((error) => {
                    log.error(logCtx, "Could not get auth providers", error);
                }),
        );

        // Recent repositories
        promises.push(
            this.getWorkspaces(ctx, {
                /* limit: 20 */
            })
                .then((workspaces) => {
                    workspaces.forEach((ws) => {
                        const repoUrl = Workspace.getFullRepositoryUrl(ws.workspace);
                        if (repoUrl) {
                            const lastUse = WorkspaceInfo.lastActiveISODate(ws);
                            suggestions.push({ url: repoUrl, lastUse, priority: 10 });
                        }
                    });
                })
                .catch((error) => {
                    log.error(logCtx, "Could not fetch recent workspace repositories", error);
                }),
        );

        await Promise.allSettled(promises);

        const uniqueURLs = new Set();
        return suggestions
            .sort((a, b) => {
                // priority first
                if (a.priority !== b.priority) {
                    return a.priority < b.priority ? 1 : -1;
                }
                // Most recently used second
                if (b.lastUse || a.lastUse) {
                    const la = a.lastUse || "";
                    const lb = b.lastUse || "";
                    return la < lb ? 1 : la === lb ? 0 : -1;
                }
                // Otherwise, alphasort
                const ua = a.url.toLowerCase();
                const ub = b.url.toLowerCase();
                return ua > ub ? 1 : ua === ub ? 0 : -1;
            })
            .filter((s) => {
                if (uniqueURLs.has(s.url)) {
                    return false;
                }
                uniqueURLs.add(s.url);
                return true;
            })
            .map((s) => s.url);
    }

    public async setWorkspaceTimeout(
        ctx: TraceContext,
        workspaceId: string,
        duration: WorkspaceTimeoutDuration,
    ): Promise<SetWorkspaceTimeoutResult> {
        traceAPIParams(ctx, { workspaceId, duration });
        traceWI(ctx, { workspaceId });

        const user = await this.checkUser("setWorkspaceTimeout");

        if (!(await this.entitlementService.maySetTimeout(user, new Date()))) {
            throw new ApplicationError(ErrorCodes.PLAN_PROFESSIONAL_REQUIRED, "Plan upgrade is required");
        }

        let validatedDuration;
        try {
            validatedDuration = WorkspaceTimeoutDuration.validate(duration);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.INVALID_VALUE, "Invalid duration : " + err.message);
        }

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        const runningInstances = await this.workspaceDb.trace(ctx).findRegularRunningInstances(user.id);
        const runningInstance = runningInstances.find((i) => i.workspaceId === workspaceId);
        if (!runningInstance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Can only set keep-alive for running workspaces");
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "update");

        const client = await this.workspaceManagerClientProvider.get(runningInstance.region);

        const req = new SetTimeoutRequest();
        req.setId(runningInstance.id);
        req.setDuration(validatedDuration);
        await client.setTimeout(ctx, req);

        return {
            resetTimeoutOnWorkspaces: [workspace.id],
            humanReadableDuration: goDurationToHumanReadable(validatedDuration),
        };
    }

    public async getWorkspaceTimeout(ctx: TraceContext, workspaceId: string): Promise<GetWorkspaceTimeoutResult> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkUser("getWorkspaceTimeout");

        const canChange = await this.entitlementService.maySetTimeout(user, new Date());

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        const runningInstance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!runningInstance) {
            log.warn({ userId: user.id, workspaceId }, "Can only get keep-alive for running workspaces");
            const duration = WORKSPACE_TIMEOUT_DEFAULT_SHORT;
            return { duration, canChange, humanReadableDuration: goDurationToHumanReadable(duration) };
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace: workspace }, "get");

        const req = new DescribeWorkspaceRequest();
        req.setId(runningInstance.id);

        const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
        const desc = await client.describeWorkspace(ctx, req);
        const duration = desc.getStatus()!.getSpec()!.getTimeout();

        return { duration, canChange, humanReadableDuration: goDurationToHumanReadable(duration) };
    }

    public async getOpenPorts(ctx: TraceContext, workspaceId: string): Promise<WorkspaceInstancePort[]> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        await this.checkAndBlockUser("getOpenPorts");

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!instance || !workspace) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
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
        const ports = status
            .getSpec()!
            .getExposedPortsList()
            .map(
                (p) =>
                    <WorkspaceInstancePort>{
                        port: p.getPort(),
                        url: p.getUrl(),
                        visibility: this.portVisibilityFromProto(p.getVisibility()),
                        protocol: this.portProtocolFromProto(p.getProtocol()),
                    },
            );

        return ports;
    }

    public async openPort(
        ctx: TraceContext,
        workspaceId: string,
        port: WorkspaceInstancePort,
    ): Promise<WorkspaceInstancePort | undefined> {
        traceAPIParams(ctx, { workspaceId, port });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("openPort");

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        const runningInstance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!runningInstance) {
            log.debug({ userId: user.id, workspaceId }, "Cannot open port for workspace with no running instance", {
                port,
            });
            return;
        }
        traceWI(ctx, { instanceId: runningInstance.id });
        await this.guardAccess({ kind: "workspaceInstance", subject: runningInstance, workspace }, "update");

        const req = new ControlPortRequest();
        req.setId(runningInstance.id);
        const spec = new PortSpec();
        spec.setPort(port.port);
        spec.setVisibility(this.portVisibilityToProto(port.visibility));
        spec.setProtocol(this.portProtocolToProto(port.protocol));
        req.setSpec(spec);
        req.setExpose(true);

        try {
            const client = await this.workspaceManagerClientProvider.get(runningInstance.region);
            await client.controlPort(ctx, req);
        } catch (e) {
            throw this.mapGrpcError(e);
        }
    }

    private portVisibilityFromProto(visibility: ProtoPortVisibility): PortVisibility {
        switch (visibility) {
            default: // the default in the protobuf def is: private
            case ProtoPortVisibility.PORT_VISIBILITY_PRIVATE:
                return "private";
            case ProtoPortVisibility.PORT_VISIBILITY_PUBLIC:
                return "public";
        }
    }

    private portVisibilityToProto(visibility: PortVisibility | undefined): ProtoPortVisibility {
        switch (visibility) {
            default: // the default for requests is: private
            case "private":
                return ProtoPortVisibility.PORT_VISIBILITY_PRIVATE;
            case "public":
                return ProtoPortVisibility.PORT_VISIBILITY_PUBLIC;
        }
    }

    private portProtocolFromProto(protocol: ProtoPortProtocol): PortProtocol {
        switch (protocol) {
            default: // the default in the protobuf def is: http
            case ProtoPortProtocol.PORT_PROTOCOL_HTTP:
                return "http";
            case ProtoPortProtocol.PORT_PROTOCOL_HTTPS:
                return "https";
        }
    }

    private portProtocolToProto(protocol: PortProtocol | undefined): ProtoPortProtocol {
        switch (protocol) {
            default: // the default for requests is: http
            case "http":
                return ProtoPortProtocol.PORT_PROTOCOL_HTTP;
            case "https":
                return ProtoPortProtocol.PORT_PROTOCOL_HTTPS;
        }
    }

    public async closePort(ctx: TraceContext, workspaceId: string, port: number) {
        traceAPIParams(ctx, { workspaceId, port });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("closePort");

        const { workspace, instance } = await this.internGetCurrentWorkspaceInstance(ctx, user, workspaceId);
        if (!instance || instance.status.phase !== "running") {
            log.debug(
                { userId: user.id, workspaceId },
                "Cannot close a port for a workspace which has no running instance",
                { port },
            );
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

        const user = await this.checkAndBlockUser("watchWorkspaceImageBuildLogs", undefined, { workspaceId });
        const client = this.client;
        if (!client) {
            return;
        }

        const logCtx: LogContext = { userId: user.id, workspaceId };
        // eslint-disable-next-line prefer-const
        let { instance, workspace } = await this.internGetCurrentWorkspaceInstance(ctx, user, workspaceId);
        if (!instance) {
            log.debug(logCtx, `No running instance for workspaceId.`);
            return;
        }
        traceWI(ctx, { instanceId: instance.id });
        const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
        await this.guardAccess({ kind: "workspaceLog", subject: workspace, teamMembers }, "get");

        // wait for up to 20s for imageBuildLogInfo to appear due to:
        //  - db-sync round-trip times
        //  - but also: wait until the image build actually started (image pull!), and log info is available!
        for (let i = 0; i < 10; i++) {
            if (instance.imageBuildInfo?.log) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const wsi = await this.workspaceDb.trace(ctx).findInstanceById(instance.id);
            if (!wsi || !["preparing", "building"].includes(wsi.status.phase)) {
                log.debug(logCtx, `imagebuild logs: instance is not/no longer in 'building' state`, {
                    phase: wsi?.status.phase,
                });
                return;
            }
            instance = wsi as WorkspaceInstance; // help the compiler a bit
        }

        const logInfo = instance.imageBuildInfo?.log;
        if (!logInfo) {
            log.error(logCtx, "cannot watch imagebuild logs for workspaceId: no image build info available");
            throw new ApplicationError(
                ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE,
                "cannot watch imagebuild logs for workspaceId",
            );
        }

        const aborted = new Deferred<boolean>();
        try {
            const logEndpoint: HeadlessLogEndpoint = {
                url: logInfo.url,
                headers: logInfo.headers,
            };
            let lineCount = 0;
            await this.headlessLogService.streamImageBuildLog(
                logCtx,
                logEndpoint,
                async (chunk) => {
                    if (aborted.isResolved) {
                        return;
                    }

                    try {
                        chunk = chunk.replace("\n", WorkspaceImageBuild.LogLine.DELIMITER);
                        lineCount += chunk.split(WorkspaceImageBuild.LogLine.DELIMITER_REGEX).length;

                        client.onWorkspaceImageBuildLogs(undefined as any, {
                            text: chunk,
                            isDiff: true,
                            upToLine: lineCount,
                        });
                    } catch (err) {
                        log.error("error while streaming imagebuild logs", err);
                        aborted.resolve(true);
                    }
                },
                aborted,
            );
        } catch (err) {
            // This error is most likely a temporary one (too early). We defer to the client whether they want to keep on trying or not.
            log.debug(logCtx, "cannot watch imagebuild logs for workspaceId", err);
            throw new ApplicationError(
                ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE,
                "cannot watch imagebuild logs for workspaceId",
            );
        } finally {
            aborted.resolve(false);
        }
    }

    async getHeadlessLog(ctx: TraceContext, instanceId: string): Promise<HeadlessLogUrls> {
        traceAPIParams(ctx, { instanceId });

        await this.checkAndBlockUser("getHeadlessLog", { instanceId });
        const logCtx: LogContext = { instanceId };

        const ws = await this.workspaceDb.trace(ctx).findByInstanceId(instanceId);
        if (!ws) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${instanceId} not found`);
        }

        const wsiPromise = this.workspaceDb.trace(ctx).findInstanceById(instanceId);
        const teamMembers = await this.getTeamMembersByProject(ws.projectId);

        await this.guardAccess({ kind: "workspaceLog", subject: ws, teamMembers }, "get");

        const wsi = await wsiPromise;
        if (!wsi) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace instance for ${instanceId} not found`);
        }

        const urls = await this.headlessLogService.getHeadlessLogURLs(logCtx, wsi, ws.ownerId);
        if (!urls || (typeof urls.streams === "object" && Object.keys(urls.streams).length === 0)) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Headless logs for ${instanceId} not found`);
        }
        return urls;
    }

    private async internGetCurrentWorkspaceInstance(
        ctx: TraceContext,
        user: User,
        workspaceId: string,
    ): Promise<{ workspace: Workspace; instance: WorkspaceInstance | undefined }> {
        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        return { instance, workspace };
    }

    async getUserStorageResource(
        ctx: TraceContext,
        options: GitpodServer.GetUserStorageResourceOptions,
    ): Promise<string> {
        traceAPIParams(ctx, { options });

        const uri = options.uri;
        const userId = (await this.checkUser("getUserStorageResource", { uri: options.uri })).id;

        await this.guardAccess({ kind: "userStorage", uri, userID: userId }, "get");

        return await this.userStorageResourcesDB.get(userId, uri);
    }

    async updateUserStorageResource(
        ctx: TraceContext,
        options: GitpodServer.UpdateUserStorageResourceOptions,
    ): Promise<void> {
        traceAPIParams(ctx, { options: censor(options, "content") }); // because may contain PII, and size (arbitrary files are stored here)

        const { uri, content } = options;
        const user = await this.checkAndBlockUser("updateUserStorageResource", { uri: options.uri });

        await this.guardAccess({ kind: "userStorage", uri, userID: user.id }, "update");

        await this.userStorageResourcesDB.update(user.id, uri, content);
    }

    async isGitHubAppEnabled(ctx: TraceContext): Promise<boolean> {
        await this.checkAndBlockUser();
        return !!this.config.githubApp?.enabled;
    }

    async registerGithubApp(ctx: TraceContext, installationId: string): Promise<void> {
        traceAPIParams(ctx, { installationId });

        const user = await this.checkAndBlockUser();

        if (!this.config.githubApp?.enabled) {
            throw new ApplicationError(
                ErrorCodes.NOT_FOUND,
                "No GitHub app enabled for this installation. Please talk to your administrator.",
            );
        }

        await this.appInstallationDB.recordNewInstallation("github", "user", installationId, user.id);
    }

    async takeSnapshot(ctx: TraceContext, options: GitpodServer.TakeSnapshotOptions): Promise<string> {
        traceAPIParams(ctx, { options });
        const { workspaceId, dontWait } = options;
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("takeSnapshot");

        const workspace = await this.guardSnaphotAccess(ctx, user.id, workspaceId);

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        if (!instance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
        }
        await this.guardAccess({ kind: "workspaceInstance", subject: instance, workspace }, "get");

        const client = await this.workspaceManagerClientProvider.get(instance.region);
        const request = new TakeSnapshotRequest();
        request.setId(instance.id);
        request.setReturnImmediately(true);

        // this triggers the snapshots, but returns early! cmp. waitForSnapshot to wait for it's completion
        let snapshotUrl;
        try {
            const resp = await client.takeSnapshot(ctx, request);
            snapshotUrl = resp.getUrl();
        } catch (err) {
            if (isClusterMaintenanceError(err)) {
                throw new ApplicationError(
                    ErrorCodes.PRECONDITION_FAILED,
                    "Cannot take a snapshot because the workspace cluster is under maintenance. Please try again in a few minutes",
                );
            }
            throw err;
        }

        const snapshot = await this.snapshotService.createSnapshot(options, snapshotUrl);

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

    /**
     * @param snapshotId
     * @throws ApplicationError with either NOT_FOUND or SNAPSHOT_ERROR in case the snapshot is not done yet.
     */
    async waitForSnapshot(ctx: TraceContext, snapshotId: string): Promise<void> {
        traceAPIParams(ctx, { snapshotId });

        const user = await this.checkAndBlockUser("waitForSnapshot");

        const snapshot = await this.workspaceDb.trace(ctx).findSnapshotById(snapshotId);
        if (!snapshot) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `No snapshot with id '${snapshotId}' found.`);
        }
        const snapshotWorkspace = await this.guardSnaphotAccess(ctx, user.id, snapshot.originalWorkspaceId);
        await this.internalDoWaitForWorkspace({ workspaceOwner: snapshotWorkspace.ownerId, snapshot });
    }

    async getSnapshots(ctx: TraceContext, workspaceId: string): Promise<string[]> {
        traceAPIParams(ctx, { workspaceId });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("getSnapshots");

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace || workspace.ownerId !== user.id) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
        }

        const snapshots = await this.workspaceDb.trace(ctx).findSnapshotsByWorkspaceId(workspaceId);
        await Promise.all(snapshots.map((s) => this.guardAccess({ kind: "snapshot", subject: s, workspace }, "get")));

        return snapshots.map((s) => s.id);
    }

    private async internalDoWaitForWorkspace(opts: WaitForSnapshotOptions) {
        try {
            await this.snapshotService.waitForSnapshot(opts);
        } catch (err) {
            // wrap in SNAPSHOT_ERROR to signal this call should not be retried.
            throw new ApplicationError(ErrorCodes.SNAPSHOT_ERROR, err.toString());
        }
    }

    async getWorkspaceEnvVars(ctx: TraceContext, workspaceId: string): Promise<EnvVarWithValue[]> {
        const user = await this.checkUser("getWorkspaceEnvVars");
        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        const envVars = await this.envVarService.resolve(workspace);

        const result: EnvVarWithValue[] = [];
        for (const value of envVars.workspace) {
            if (
                "repositoryPattern" in value &&
                !(await this.resourceAccessGuard.canAccess({ kind: "envVar", subject: value }, "get"))
            ) {
                continue;
            }
            result.push(value);
        }
        return result;
    }

    // Get all environment variables (unfiltered)
    async getAllEnvVars(ctx: TraceContext): Promise<UserEnvVarValue[]> {
        const user = await this.checkUser("getAllEnvVars");
        const result: UserEnvVarValue[] = [];
        for (const value of await this.userDB.getEnvVars(user.id)) {
            if (!(await this.resourceAccessGuard.canAccess({ kind: "envVar", subject: value }, "get"))) {
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
        traceAPIParams(ctx, { variable: censor(variable, "value") }); // filter content because of PII

        // Note: this operation is per-user only, hence needs no resource guard
        const user = await this.checkAndBlockUser("setEnvVar");
        const userId = user.id;

        // validate input
        const validationError = UserEnvVar.validate(variable);
        if (validationError) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, validationError);
        }

        variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);
        const existingVars = (await this.userDB.getEnvVars(user.id)).filter((v) => !v.deleted);

        const existingVar = existingVars.find(
            (v) => v.name == variable.name && v.repositoryPattern == variable.repositoryPattern,
        );
        if (!!existingVar) {
            // overwrite existing variable rather than introduce a duplicate
            variable.id = existingVar.id;
        }

        if (!variable.id) {
            // this is a new variable - make sure the user does not have too many (don't DOS our database using gp env)
            const varCount = existingVars.length;
            if (varCount > this.config.maxEnvvarPerUserCount) {
                throw new ApplicationError(
                    ErrorCodes.PERMISSION_DENIED,
                    `cannot have more than ${this.config.maxEnvvarPerUserCount} environment variables`,
                );
            }
        }

        const envvar: UserEnvVar = {
            id: variable.id || uuidv4(),
            name: variable.name,
            repositoryPattern: variable.repositoryPattern,
            value: variable.value,
            userId,
        };
        await this.guardAccess(
            { kind: "envVar", subject: envvar },
            typeof variable.id === "string" ? "update" : "create",
        );
        this.analytics.track({ event: "envvar-set", userId });

        await this.userDB.setEnvVar(envvar);
    }

    async deleteEnvVar(ctx: TraceContext, variable: UserEnvVarValue): Promise<void> {
        traceAPIParams(ctx, { variable: censor(variable, "value") });

        // Note: this operation is per-user only, hence needs no resource guard
        const user = await this.checkAndBlockUser("deleteEnvVar");
        const userId = user.id;

        if (!variable.id && variable.name && variable.repositoryPattern) {
            variable.repositoryPattern = UserEnvVar.normalizeRepoPattern(variable.repositoryPattern);
            const existingVars = (await this.userDB.getEnvVars(user.id)).filter((v) => !v.deleted);
            const existingVar = existingVars.find(
                (v) => v.name == variable.name && v.repositoryPattern == variable.repositoryPattern,
            );
            variable.id = existingVar?.id;
        }

        if (!variable.id) {
            throw new ApplicationError(
                ErrorCodes.NOT_FOUND,
                `cannot delete '${variable.name}' in scope '${variable.repositoryPattern}'`,
            );
        }

        const envvar: UserEnvVar = {
            ...variable,
            id: variable.id!,
            userId,
        };
        await this.guardAccess({ kind: "envVar", subject: envvar }, "delete");
        this.analytics.track({ event: "envvar-deleted", userId });

        await this.userDB.deleteEnvVar(envvar);
    }

    async hasSSHPublicKey(ctx: TraceContext): Promise<boolean> {
        const user = await this.checkUser("hasSSHPublicKey");
        return this.userDB.hasSSHPublicKey(user.id);
    }

    async getSSHPublicKeys(ctx: TraceContext): Promise<UserSSHPublicKeyValue[]> {
        const user = await this.checkUser("getSSHPublicKeys");
        const list = await this.userDB.getSSHPublicKeys(user.id);
        return list.map((e) => ({
            id: e.id,
            name: e.name,
            key: e.key,
            fingerprint: e.fingerprint,
            creationTime: e.creationTime,
            lastUsedTime: e.lastUsedTime,
        }));
    }

    async addSSHPublicKey(ctx: TraceContext, value: SSHPublicKeyValue): Promise<UserSSHPublicKeyValue> {
        const user = await this.checkUser("addSSHPublicKey");
        const data = await this.userDB.addSSHPublicKey(user.id, value);
        this.updateSSHKeysForRegularRunningInstances(ctx, user.id).catch(console.error);
        return {
            id: data.id,
            name: data.name,
            key: data.key,
            fingerprint: data.fingerprint,
            creationTime: data.creationTime,
            lastUsedTime: data.lastUsedTime,
        };
    }

    async deleteSSHPublicKey(ctx: TraceContext, id: string): Promise<void> {
        const user = await this.checkUser("deleteSSHPublicKey");
        await this.userDB.deleteSSHPublicKey(user.id, id);
        this.updateSSHKeysForRegularRunningInstances(ctx, user.id).catch(console.error);
        return;
    }

    private async updateSSHKeysForRegularRunningInstances(ctx: TraceContext, userId: string) {
        const keys = (await this.userDB.getSSHPublicKeys(userId)).map((e) => e.key);
        const instances = await this.workspaceDb.trace(ctx).findRegularRunningInstances(userId);
        const updateKeyOfInstance = async (instance: WorkspaceInstance) => {
            try {
                const req = new UpdateSSHKeyRequest();
                req.setId(instance.id);
                req.setKeysList(keys);
                const cli = await this.workspaceManagerClientProvider.get(instance.region);
                await cli.updateSSHPublicKey(ctx, req);
            } catch (err) {
                const logCtx = { userId, instanceId: instance.id };
                log.error(logCtx, "Could not update ssh public key for instance", err);
            }
        };
        return Promise.allSettled(instances.map((e) => updateKeyOfInstance(e)));
    }

    async setProjectEnvironmentVariable(
        ctx: TraceContext,
        projectId: string,
        name: string,
        value: string,
        censored: boolean,
    ): Promise<void> {
        traceAPIParams(ctx, { projectId, name }); // value may contain secrets
        const user = await this.checkAndBlockUser("setProjectEnvironmentVariable");
        await this.guardProjectOperation(user, projectId, "update");
        return this.projectsService.setProjectEnvironmentVariable(user.id, projectId, name, value, censored);
    }

    async getProjectEnvironmentVariables(ctx: TraceContext, projectId: string): Promise<ProjectEnvVar[]> {
        traceAPIParams(ctx, { projectId });
        const user = await this.checkAndBlockUser("getProjectEnvironmentVariables");
        await this.guardProjectOperation(user, projectId, "get");
        return await this.projectsService.getProjectEnvironmentVariables(user.id, projectId);
    }

    async deleteProjectEnvironmentVariable(ctx: TraceContext, variableId: string): Promise<void> {
        traceAPIParams(ctx, { variableId });
        const user = await this.checkAndBlockUser("deleteProjectEnvironmentVariable");
        const envVar = await this.projectsService.getProjectEnvironmentVariableById(user.id, variableId);
        if (!envVar) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Project environment variable not found");
        }
        await this.guardProjectOperation(user, envVar.projectId, "update");
        return this.projectsService.deleteProjectEnvironmentVariable(user.id, envVar.id);
    }

    private async guardSnaphotAccess(ctx: TraceContext, userId: string, workspaceId: string): Promise<Workspace> {
        traceAPIParams(ctx, { userId, workspaceId });

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace || workspace.ownerId !== userId) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} does not exist.`);
        }
        await this.guardAccess({ kind: "snapshot", subject: undefined, workspace }, "create");

        return workspace;
    }

    private async guardTeamOperation(
        teamId: string,
        op: ResourceAccessOp,
        fineGrainedOp: OrganizationPermission | "not_implemented",
    ): Promise<{ team: Team; members: TeamMemberInfo[] }> {
        if (!uuidValidate(teamId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organization ID must be a valid UUID");
        }

        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Organization ID: ${teamId} not found.`);
        }

        const members = await this.teamDB.findMembersByTeam(team.id);

        if (!(await this.hasOrgOperationPermission(team, members, op, fineGrainedOp))) {
            // if user has read permission, throw 403, otherwise 404
            if (await this.hasOrgOperationPermission(team, members, "get", "read_info")) {
                throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, `No access to Organization ID: ${teamId}`);
            } else {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `Organization ID: ${teamId} not found.`);
            }
        }
        return { team, members };
    }

    private async hasOrgOperationPermission(
        org: Organization,
        members: TeamMemberInfo[],
        op: ResourceAccessOp,
        fineGrainedOp: OrganizationPermission | "not_implemented",
    ): Promise<boolean> {
        const user = await this.checkUser("hasOrgOperationPermission");
        const checkAgainstDB = async () => {
            try {
                await this.guardAccess({ kind: "team", subject: org, members }, op);
                return true;
            } catch (error) {
                if (error.code === ErrorCodes.PERMISSION_DENIED) {
                    return false;
                } else {
                    throw error;
                }
            }
        };
        if (fineGrainedOp === "not_implemented") {
            // we ignore fine grained permissions if not implemented
            return checkAgainstDB();
        }
        // run check against old DB logic and new permission system in parallel
        const [fromDB, fromCentralizedPerms] = await Promise.allSettled([
            checkAgainstDB(),
            this.auth.hasPermissionOnOrganization(user.id, fineGrainedOp, org.id),
        ]);

        // if fromDB errored we throw here
        if (fromDB.status === "rejected") {
            throw fromDB.reason;
        }
        // report what we got from centralized perms
        if (fromCentralizedPerms.status === "fulfilled") {
            if (
                await getExperimentsClientForBackend().getValueAsync("centralizedPermissions", false, {
                    teamId: org.id,
                })
            ) {
                reportCentralizedPermsValidation(fineGrainedOp, fromDB.value === fromCentralizedPerms.value);
            }
        }

        return fromDB.value;
    }

    public async getTeams(ctx: TraceContext): Promise<Organization[]> {
        // Note: this operation is per-user only, hence needs no resource guard
        const user = await this.checkUser("getOrganizations");
        const orgs = await this.organizationService.listOrganizationsByMember(user.id, user.id);

        const filterOrg = async (org: Organization): Promise<Organization | undefined> => {
            const members = await this.organizationService.listMembers(user.id, org.id);
            if (!(await this.hasOrgOperationPermission(org, members, "get", "read_info"))) {
                return undefined;
            }
            return org;
        };

        const accessibleOrgs = [];
        for (const check of orgs.map(filterOrg)) {
            const org = await check;
            if (org) {
                accessibleOrgs.push(org);
            }
        }
        return accessibleOrgs;
    }

    public async getTeam(ctx: TraceContext, teamId: string): Promise<Team> {
        traceAPIParams(ctx, { teamId });

        await this.checkAndBlockUser("getTeam");

        const { team } = await this.guardTeamOperation(teamId, "get", "read_info");
        return team;
    }

    public async updateTeam(ctx: TraceContext, teamId: string, team: Pick<Team, "name">): Promise<Team> {
        traceAPIParams(ctx, { teamId });
        const user = await this.checkUser("updateTeam");

        await this.guardTeamOperation(teamId, "update", "write_info");

        return this.organizationService.updateOrganization(user.id, teamId, team);
    }

    public async getTeamMembers(ctx: TraceContext, teamId: string): Promise<TeamMemberInfo[]> {
        traceAPIParams(ctx, { teamId });

        await this.checkUser("getTeamMembers");
        const { members } = await this.guardTeamOperation(teamId, "get", "read_members");

        return members;
    }

    public async createTeam(ctx: TraceContext, name: string): Promise<Team> {
        traceAPIParams(ctx, { name });

        // Note: this operation is per-user only, hence needs no resource guard
        const user = await this.checkAndBlockUser("createTeam");

        const mayCreateOrganization = await this.userService.mayCreateOrJoinOrganization(user);
        if (!mayCreateOrganization) {
            throw new ApplicationError(
                ErrorCodes.PERMISSION_DENIED,
                "Organizational accounts are not allowed to create new organizations",
            );
        }

        const org = await this.organizationService.createOrganization(user.id, name);
        // create a cost center
        await this.usageService.getCostCenter(user.id, org.id);

        ctx.span?.setTag("teamId", org.id);
        return org;
    }

    public async joinTeam(ctx: TraceContext, inviteId: string): Promise<Team> {
        traceAPIParams(ctx, { inviteId });

        const user = await this.checkAndBlockUser("joinTeam");

        const mayCreateOrganization = await this.userService.mayCreateOrJoinOrganization(user);
        if (!mayCreateOrganization) {
            throw new ApplicationError(
                ErrorCodes.PERMISSION_DENIED,
                "Organizational accounts are not allowed to join other organizations",
            );
        }

        const orgId = await this.organizationService.joinOrganization(user.id, inviteId);
        const org = await this.getTeam(ctx, orgId);
        if (org !== undefined) {
            try {
                // verify the new member if this org is a paying customer
                if (
                    (await this.stripeService.findUncancelledSubscriptionByAttributionId(
                        AttributionId.render({ kind: "team", teamId: org.id }),
                    )) !== undefined
                ) {
                    await this.verificationService.verifyUser(user);
                }
            } catch (e) {
                log.warn("Failed to verify new org member", e);
            }
        }

        return org!;
    }

    public async setTeamMemberRole(
        ctx: TraceContext,
        teamId: string,
        userId: string,
        role: TeamMemberRole,
    ): Promise<void> {
        traceAPIParams(ctx, { teamId, userId, role });

        const requestor = await this.checkAndBlockUser("setTeamMemberRole");

        if (!uuidValidate(userId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "user ID must be a valid UUID");
        }

        if (!TeamMemberRole.isValid(role)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "invalid role name");
        }

        await this.guardTeamOperation(teamId, "update", "write_members");
        await this.organizationService.addOrUpdateMember(requestor.id, teamId, userId, role);
    }

    public async removeTeamMember(ctx: TraceContext, orgID: string, userId: string): Promise<void> {
        traceAPIParams(ctx, { teamId: orgID, userId });

        if (!uuidValidate(userId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "user ID must be a valid UUID");
        }

        const requestor = await this.checkAndBlockUser("removeTeamMember");

        // The user is leaving a team, if they are removing themselves from the team.
        const currentUserLeavingTeam = requestor.id === userId;
        if (!currentUserLeavingTeam) {
            await this.guardTeamOperation(orgID, "update", "write_members");
        } else {
            await this.guardTeamOperation(orgID, "get", "leave");
        }

        await this.organizationService.removeOrganizationMember(requestor.id, orgID, userId);
    }

    public async getGenericInvite(ctx: TraceContext, teamId: string): Promise<TeamMembershipInvite> {
        traceAPIParams(ctx, { teamId });

        const user = await this.checkUser("getGenericInvite");
        await this.guardTeamOperation(teamId, "update", "write_members");

        return this.organizationService.getOrCreateInvite(user.id, teamId);
    }

    public async resetGenericInvite(ctx: TraceContext, teamId: string): Promise<TeamMembershipInvite> {
        traceAPIParams(ctx, { teamId });

        const user = await this.checkAndBlockUser("resetGenericInvite");
        await this.guardTeamOperation(teamId, "update", "write_members");
        return this.organizationService.resetInvite(user.id, teamId);
    }

    private async guardProjectOperation(user: User, projectId: string, op: ResourceAccessOp): Promise<void> {
        const project = await this.projectsService.getProject(user.id, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        // TODO(janx): This if/else block should probably become a GuardedProject.
        if (project.userId) {
            if (user.id !== project.userId) {
                // Projects owned by a single user can only be accessed by that user
                throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "Not allowed to access this project");
            }
        } else {
            // Anyone who can read a team's information (i.e. any team member) can manage team projects
            await this.guardTeamOperation(project.teamId || "", "get", "not_implemented");
        }
    }

    public async deleteProject(ctx: TraceContext, projectId: string): Promise<void> {
        traceAPIParams(ctx, { projectId });

        const user = await this.checkUser("deleteProject");
        await this.guardProjectOperation(user, projectId, "delete");
        return this.projectsService.deleteProject(user.id, projectId);
    }

    public async deleteTeam(ctx: TraceContext, teamId: string): Promise<void> {
        const user = await this.checkAndBlockUser("deleteTeam");
        traceAPIParams(ctx, { teamId, userId: user.id });

        await this.guardTeamOperation(teamId, "delete", "delete");
        await this.organizationService.deleteOrganization(user.id, teamId);
    }

    async getOrgSettings(ctx: TraceContextWithSpan, orgId: string): Promise<OrganizationSettings> {
        const user = await this.checkAndBlockUser("getOrgSettings");
        traceAPIParams(ctx, { orgId, userId: user.id });
        await this.guardTeamOperation(orgId, "get", "read_settings");
        return this.organizationService.getSettings(user.id, orgId);
    }

    async updateOrgSettings(
        ctx: TraceContextWithSpan,
        orgId: string,
        settings: Partial<OrganizationSettings>,
    ): Promise<OrganizationSettings> {
        const user = await this.checkAndBlockUser("updateOrgSettings");
        traceAPIParams(ctx, { orgId, userId: user.id });
        await this.guardTeamOperation(orgId, "update", "write_settings");
        return this.organizationService.updateSettings(user.id, orgId, settings);
    }

    public async getTeamProjects(ctx: TraceContext, teamId: string): Promise<Project[]> {
        traceAPIParams(ctx, { teamId });

        const user = await this.checkUser("getTeamProjects");

        await this.guardTeamOperation(teamId, "get", "not_implemented");
        return this.projectsService.getProjects(user.id, teamId);
    }

    public async findPrebuilds(ctx: TraceContext, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        traceAPIParams(ctx, { params });

        const user = await this.checkAndBlockUser("findPrebuilds");
        await this.guardProjectOperation(user, params.projectId, "get");
        return this.projectsService.findPrebuilds(user.id, params);
    }

    public async getPrebuild(ctx: TraceContext, prebuildId: string): Promise<PrebuildWithStatus | undefined> {
        traceAPIParams(ctx, { prebuildId });
        await this.checkAndBlockUser("getPrebuild");

        const pbws = await this.workspaceDb.trace(ctx).findPrebuiltWorkspaceById(prebuildId);
        if (!pbws) {
            return undefined;
        }
        const [info, workspace] = await Promise.all([
            this.workspaceDb
                .trace(ctx)
                .findPrebuildInfos([prebuildId])
                .then((infos) => (infos.length > 0 ? infos[0] : undefined)),
            this.workspaceDb.trace(ctx).findById(pbws.buildWorkspaceId),
        ]);
        if (!info || !workspace) {
            return undefined;
        }

        // TODO(gpl) Ideally, we should not need to query the project-team hierarchy here, but decide on a per-prebuild basis.
        // For that we need to fix Prebuild-access semantics, which is out-of-scope for now.
        const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
        await this.guardAccess({ kind: "prebuild", subject: pbws, workspace, teamMembers }, "get");
        const result: PrebuildWithStatus = { info, status: pbws.state };
        if (pbws.error) {
            result.error = pbws.error;
        }
        return result;
    }

    public async findPrebuildByWorkspaceID(
        ctx: TraceContext,
        workspaceId: string,
    ): Promise<PrebuiltWorkspace | undefined> {
        traceAPIParams(ctx, { workspaceId });
        await this.checkAndBlockUser("findPrebuildByWorkspaceID");

        const [pbws, workspace] = await Promise.all([
            this.workspaceDb.trace(ctx).findPrebuildByWorkspaceID(workspaceId),
            this.workspaceDb.trace(ctx).findById(workspaceId),
        ]);
        if (!pbws || !workspace) {
            return undefined;
        }

        // TODO(gpl) Ideally, we should not need to query the project-team hierarchy here, but decide on a per-prebuild basis.
        // For that we need to fix Prebuild-access semantics, which is out-of-scope for now.
        const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
        await this.guardAccess({ kind: "prebuild", subject: pbws, workspace, teamMembers }, "get");
        return pbws;
    }

    public async getProjectOverview(ctx: TraceContext, projectId: string): Promise<Project.Overview | undefined> {
        traceAPIParams(ctx, { projectId });

        const user = await this.checkAndBlockUser("getProjectOverview");
        await this.guardProjectOperation(user, projectId, "get");
        try {
            const result = await this.projectsService.getProjectOverview(user, projectId);
            if (result) {
                result.isConsideredInactive = await this.projectsService.isProjectConsideredInactive(
                    user.id,
                    projectId,
                );
            }
            return result;
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }
            throw error;
        }
    }

    async adminFindPrebuilds(ctx: TraceContext, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        traceAPIParams(ctx, { params });
        const user = await this.guardAdminAccess("adminFindPrebuilds", { params }, Permission.ADMIN_PROJECTS);

        return this.projectsService.findPrebuilds(user.id, params);
    }

    async cancelPrebuild(ctx: TraceContext, projectId: string, prebuildId: string): Promise<void> {
        traceAPIParams(ctx, { projectId, prebuildId });

        const user = await this.checkAndBlockUser("cancelPrebuild");

        const project = await this.projectsService.getProject(user.id, projectId);
        if (!project) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "update");

        const prebuild = await this.workspaceDb.trace(ctx).findPrebuildByID(prebuildId);
        if (!prebuild) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Prebuild not found");
        }
        // Explicitly stopping the prebuild workspace now automaticaly cancels the prebuild
        await this.stopWorkspace(ctx, prebuild.buildWorkspaceId);
    }

    public async createProject(ctx: TraceContext, params: CreateProjectParams): Promise<Project> {
        traceAPIParams(ctx, { params });

        const user = await this.checkUser("createProject");

        // Anyone who can read a team's information (i.e. any team member) can create a new project.
        await this.guardTeamOperation(params.teamId || "", "get", "not_implemented");

        // Check if provided clone URL is accessible for the current user, and user has admin permissions.
        let url;
        try {
            url = new URL(params.cloneUrl);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Clone URL must be a valid URL.");
        }
        const availableRepositories = await this.getProviderRepositoriesForUser(ctx, { provider: url.host });
        if (!availableRepositories.some((r) => r.cloneUrl === params.cloneUrl)) {
            // The error message is derived from internals of `getProviderRepositoriesForUser` and
            // `getRepositoriesForAutomatedPrebuilds`, which require admin permissions to be present.
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "Repository URL seems to be inaccessible, or admin permissions are missing.",
            );
        }

        const project = await this.projectsService.createProject(params, user);
        // update client registration for the logged in user
        const prebuildUpdateHandler = (ctx: TraceContext, update: PrebuildWithStatus) =>
            TraceContext.withSpan(
                "forwardPrebuildUpdateToClient",
                (ctx) => {
                    traceClientMetadata(ctx, this.clientMetadata);
                    TraceContext.setJsonRPCMetadata(ctx, "onPrebuildUpdate");

                    this.client?.onPrebuildUpdate(update);
                },
                ctx,
            );
        this.disposables.pushAll([this.subscriber.listenForPrebuildUpdates(project.id, prebuildUpdateHandler)]);

        return project;
    }

    public async updateProjectPartial(ctx: TraceContext, partialProject: PartialProject): Promise<void> {
        traceAPIParams(ctx, {
            // censor everything irrelevant
            partialProject: {
                id: partialProject.id,
                settings: partialProject.settings,
            },
        });

        const user = await this.checkUser("updateProjectPartial");
        await this.guardProjectOperation(user, partialProject.id, "update");
        await this.projectsService.updateProject(user.id, partialProject);
    }

    public async getGitpodTokens(ctx: TraceContext): Promise<GitpodToken[]> {
        const user = await this.checkAndBlockUser("getGitpodTokens");
        const res = (await this.userDB.findAllGitpodTokensOfUser(user.id)).filter((v) => !v.deleted);
        await Promise.all(res.map((tkn) => this.guardAccess({ kind: "gitpodToken", subject: tkn }, "get")));
        return res;
    }

    public async generateNewGitpodToken(
        ctx: TraceContext,
        options: { name?: string; type: GitpodTokenType; scopes?: string[] },
    ): Promise<string> {
        traceAPIParams(ctx, { options });

        const user = await this.checkAndBlockUser("generateNewGitpodToken");
        const token = crypto.randomBytes(30).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
        const dbToken: DBGitpodToken = {
            tokenHash,
            name: options.name,
            type: options.type,
            userId: user.id,
            scopes: options.scopes || [],
            created: new Date().toISOString(),
        };
        await this.guardAccess({ kind: "gitpodToken", subject: dbToken }, "create");

        await this.userDB.storeGitpodToken(dbToken);
        return token;
    }

    public async getGitpodTokenScopes(ctx: TraceContext, tokenHash: string): Promise<string[]> {
        traceAPIParams(ctx, {}); // do not trace tokenHash

        const user = await this.checkAndBlockUser("getGitpodTokenScopes");
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
        traceAPIParams(ctx, {}); // do not trace tokenHash

        const user = await this.checkAndBlockUser("deleteGitpodToken");
        const existingTokens = await this.getGitpodTokens(ctx); // all tokens for logged in user
        const tkn = existingTokens.find((token) => token.tokenHash === tokenHash);
        if (!tkn) {
            throw new Error(`User ${user.id} tries to delete a token ${tokenHash} that does not exist.`);
        }
        await this.guardAccess({ kind: "gitpodToken", subject: tkn }, "delete");
        return this.userDB.deleteGitpodToken(tokenHash);
    }

    async guessGitTokenScopes(ctx: TraceContext, params: GuessGitTokenScopesParams): Promise<GuessedGitTokenScopes> {
        traceAPIParams(ctx, { params: censor(params, "currentToken") });

        const authProviders = await this.getAuthProviders(ctx);
        return this.gitTokenScopeGuesser.guessGitTokenScopes(
            authProviders.find((p) => p.host == params.host),
            params,
        );
    }

    async adminGetUser(ctx: TraceContext, userId: string): Promise<User> {
        traceAPIParams(ctx, { userId });

        await this.guardAdminAccess("adminGetUser", { id: userId }, Permission.ADMIN_USERS);

        let result: User | undefined;
        try {
            result = await this.userDB.findUserById(userId);
        } catch (e) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }

        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
        }
        return result;
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
            return res;
        } catch (e) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
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
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
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

        return targetUser;
    }

    async adminDeleteUser(ctx: TraceContext, userId: string): Promise<void> {
        traceAPIParams(ctx, { userId });

        await this.guardAdminAccess("adminDeleteUser", { id: userId }, Permission.ADMIN_PERMISSIONS);

        try {
            await this.userDeletionService.deleteUser(userId);
        } catch (e) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }
    }

    async adminVerifyUser(ctx: TraceContext, userId: string): Promise<User> {
        await this.guardAdminAccess("adminVerifyUser", { id: userId }, Permission.ADMIN_USERS);
        try {
            const user = await this.userDB.findUserById(userId);
            if (!user) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `No user with id ${userId} found.`);
            }
            this.verificationService.markVerified(user);
            await this.userDB.updateUserPartial(user);
            return user;
        } catch (e) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }
    }

    async adminModifyRoleOrPermission(ctx: TraceContext, req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        traceAPIParams(ctx, { req });

        await this.guardAdminAccess("adminModifyRoleOrPermission", { req }, Permission.ADMIN_PERMISSIONS);

        const target = await this.userDB.findUserById(req.id);
        if (!target) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
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

        return await this.userDB.storeUser(target);
    }

    async adminModifyPermanentWorkspaceFeatureFlag(
        ctx: TraceContext,
        req: AdminModifyPermanentWorkspaceFeatureFlagRequest,
    ): Promise<User> {
        traceAPIParams(ctx, { req });

        await this.guardAdminAccess("adminModifyPermanentWorkspaceFeatureFlag", { req }, Permission.ADMIN_USERS);
        const target = await this.userDB.findUserById(req.id);
        if (!target) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
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

        return await this.userDB.storeUser(target);
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
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
        }
        return result;
    }

    async adminGetWorkspaceInstances(ctx: TraceContext, workspaceId: string): Promise<WorkspaceInstance[]> {
        traceAPIParams(ctx, { workspaceId });

        await this.guardAdminAccess("adminGetWorkspaceInstances", { id: workspaceId }, Permission.ADMIN_WORKSPACES);

        const result = await this.workspaceDb.trace(ctx).findInstances(workspaceId);
        return result || [];
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
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `No workspace with id '${workspaceId}' found.`);
            }
            if (!ws.softDeleted) {
                return;
            }
            if (!!ws.contentDeletedTime) {
                throw new ApplicationError(
                    ErrorCodes.NOT_FOUND,
                    "The workspace content was already garbage-collected.",
                );
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
        const user = await this.guardAdminAccess("adminGetProjectsBySearchTerm", { req }, Permission.ADMIN_PROJECTS);
        return await this.projectsService.findProjects(user.id, {
            offset: req.offset,
            limit: req.limit,
            orderBy: req.orderBy,
            orderDir: req.orderDir === "asc" ? "ASC" : "DESC",
            searchTerm: req.searchTerm as string,
        });
    }

    async adminGetProjectById(ctx: TraceContext, id: string): Promise<Project | undefined> {
        const user = await this.guardAdminAccess("adminGetProjectById", { id }, Permission.ADMIN_PROJECTS);
        return await this.projectsService.getProject(user.id, id);
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
        const user = await this.guardAdminAccess("adminGetTeamById", { id }, Permission.ADMIN_WORKSPACES);
        return this.organizationService.getOrganization(user.id, id);
    }

    async adminGetTeamMembers(ctx: TraceContext, teamId: string): Promise<TeamMemberInfo[]> {
        const user = await this.guardAdminAccess("adminGetTeamMembers", { teamId }, Permission.ADMIN_WORKSPACES);
        return this.organizationService.listMembers(user.id, teamId);
    }

    async adminSetTeamMemberRole(
        ctx: TraceContext,
        teamId: string,
        memberId: string,
        role: TeamMemberRole,
    ): Promise<void> {
        const user = await this.guardAdminAccess(
            "adminSetTeamMemberRole",
            { teamId, userId: memberId, role },
            Permission.ADMIN_WORKSPACES,
        );
        return this.organizationService.addOrUpdateMember(user.id, teamId, memberId, role);
    }

    async getOwnAuthProviders(ctx: TraceContext): Promise<AuthProviderEntry[]> {
        const redacted = (entry: AuthProviderEntry) => AuthProviderEntry.redact(entry);
        const user = await this.checkAndBlockUser("getOwnAuthProviders");
        const ownAuthProviders = await this.authProviderService.getAuthProvidersOfUser(user.id);
        return ownAuthProviders.map(redacted);
    }

    async updateOwnAuthProvider(
        ctx: TraceContext,
        { entry }: GitpodServer.UpdateOwnAuthProviderParams,
    ): Promise<AuthProviderEntry> {
        traceAPIParams(ctx, {}); // entry contains PII

        const user = await this.checkAndBlockUser("updateOwnAuthProvider");
        if (user.id !== entry.ownerId) {
            throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "Not allowed to modify this resource.");
        }

        const safeProvider = this.redactUpdateOwnAuthProviderParams({ entry });
        try {
            if ("host" in safeProvider) {
                // on creating we're are checking for already existing runtime providers

                const host = safeProvider.host && safeProvider.host.toLowerCase();

                if (!(await this.authProviderService.isHostReachable(host))) {
                    log.debug(`Host could not be reached.`, { entry, safeProvider });
                    throw new Error("Host could not be reached.");
                }

                const hostContext = this.hostContextProvider.get(host);
                if (hostContext) {
                    const builtInExists = hostContext.authProvider.params.ownerId === undefined;
                    log.debug(`Attempt to override existing auth provider.`, { entry, safeProvider, builtInExists });
                    throw new Error("Provider for this host already exists.");
                }
            }
            const result = await this.authProviderService.updateAuthProvider(safeProvider);
            return AuthProviderEntry.redact(result);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to update the provider.";
            throw new ApplicationError(ErrorCodes.CONFLICT, message);
        }
    }
    private redactUpdateOwnAuthProviderParams({ entry }: GitpodServer.UpdateOwnAuthProviderParams) {
        const safeEntry =
            "id" in entry
                ? <AuthProviderEntry.UpdateEntry>{
                      id: entry.id,
                      clientId: entry.clientId,
                      clientSecret: entry.clientSecret,
                      ownerId: entry.ownerId,
                  }
                : <AuthProviderEntry.NewEntry>{
                      host: entry.host,
                      type: entry.type,
                      clientId: entry.clientId,
                      clientSecret: entry.clientSecret,
                      ownerId: entry.ownerId,
                  };
        return safeEntry;
    }

    async deleteOwnAuthProvider(ctx: TraceContext, params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void> {
        traceAPIParams(ctx, { params });

        const user = await this.checkAndBlockUser("deleteOwnAuthProvider");
        const ownProviders = await this.authProviderService.getAuthProvidersOfUser(user.id);
        const authProvider = ownProviders.find((p) => p.id === params.id);
        if (!authProvider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "User resource not found.");
        }
        try {
            await this.authProviderService.deleteAuthProvider(authProvider);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to delete the provider.";
            throw new ApplicationError(ErrorCodes.CONFLICT, message);
        }
    }

    async createOrgAuthProvider(
        ctx: TraceContext,
        { entry }: GitpodServer.CreateOrgAuthProviderParams,
    ): Promise<AuthProviderEntry> {
        traceAPIParams(ctx, {}); // entry contains PII

        const user = await this.checkAndBlockUser("createOrgAuthProvider");

        // map params to a new provider
        const newProvider = <AuthProviderEntry.NewOrgEntry>{
            host: entry.host,
            type: entry.type,
            clientId: entry.clientId,
            clientSecret: entry.clientSecret,
            ownerId: user.id,
            organizationId: entry.organizationId,
        };

        if (!newProvider.organizationId || !uuidValidate(newProvider.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid organizationId");
        }

        await this.guardWithFeatureFlag("orgGitAuthProviders", user, newProvider.organizationId);

        await this.guardTeamOperation(newProvider.organizationId, "update", "write_git_provider");

        if (!newProvider.host) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "Must provider a host value when creating a new auth provider.",
            );
        }

        try {
            // on creating we're are checking for already existing runtime providers
            const host = newProvider.host && newProvider.host.toLowerCase();

            if (!(await this.authProviderService.isHostReachable(host))) {
                log.debug(`Host could not be reached.`, { entry, newProvider });
                throw new Error("Host could not be reached.");
            }

            const hostContext = this.hostContextProvider.get(host);
            if (hostContext) {
                const builtInExists = hostContext.authProvider.params.ownerId === undefined;
                log.debug(`Attempt to override existing auth provider.`, { entry, newProvider, builtInExists });
                throw new Error("Provider for this host already exists.");
            }

            const result = await this.authProviderService.createOrgAuthProvider(newProvider);
            return AuthProviderEntry.redact(result);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to create the provider.";
            throw new ApplicationError(ErrorCodes.CONFLICT, message);
        }
    }

    async updateOrgAuthProvider(
        ctx: TraceContext,
        { entry }: GitpodServer.UpdateOrgAuthProviderParams,
    ): Promise<AuthProviderEntry> {
        traceAPIParams(ctx, {}); // entry contains PII

        const user = await this.checkAndBlockUser("updateOrgAuthProvider");

        // map params to a provider update
        const providerUpdate: AuthProviderEntry.UpdateOrgEntry = {
            id: entry.id,
            clientId: entry.clientId,
            clientSecret: entry.clientSecret,
            organizationId: entry.organizationId,
        };

        if (!providerUpdate.organizationId || !uuidValidate(providerUpdate.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid organizationId");
        }

        await this.guardWithFeatureFlag("orgGitAuthProviders", user, providerUpdate.organizationId);

        await this.guardTeamOperation(providerUpdate.organizationId, "update", "write_git_provider");

        try {
            const result = await this.authProviderService.updateOrgAuthProvider(providerUpdate);
            return AuthProviderEntry.redact(result);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to update the provider.";
            throw new ApplicationError(ErrorCodes.CONFLICT, message);
        }
    }

    async getOrgAuthProviders(
        ctx: TraceContext,
        params: GitpodServer.GetOrgAuthProviderParams,
    ): Promise<AuthProviderEntry[]> {
        traceAPIParams(ctx, { params });

        const user = await this.checkAndBlockUser("getOrgAuthProviders");

        await this.guardWithFeatureFlag("orgGitAuthProviders", user, params.organizationId);

        await this.guardTeamOperation(params.organizationId, "get", "read_git_provider");

        try {
            const result = await this.authProviderService.getAuthProvidersOfOrg(params.organizationId);
            return result.map(AuthProviderEntry.redact.bind(AuthProviderEntry));
        } catch (error) {
            const message =
                error && error.message ? error.message : "Error retreiving auth providers for organization.";
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, message);
        }
    }

    async deleteOrgAuthProvider(ctx: TraceContext, params: GitpodServer.DeleteOrgAuthProviderParams): Promise<void> {
        traceAPIParams(ctx, { params });

        const user = await this.checkAndBlockUser("deleteOrgAuthProvider");

        const team = await this.getTeam(ctx, params.organizationId);
        if (!team) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid organizationId");
        }

        await this.guardWithFeatureFlag("orgGitAuthProviders", user, team.id);

        await this.guardTeamOperation(params.organizationId || "", "update", "write_git_provider");

        // Find the matching auth provider we're attempting to delete
        const orgProviders = await this.authProviderService.getAuthProvidersOfOrg(team.id);
        const authProvider = orgProviders.find((p) => p.id === params.id && p.organizationId === params.organizationId);
        if (!authProvider) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Provider resource not found.");
        }

        try {
            await this.authProviderService.deleteAuthProvider(authProvider);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to delete the provider.";
            throw new ApplicationError(ErrorCodes.CONFLICT, message);
        }
    }

    async getOnboardingState(ctx: TraceContext): Promise<GitpodServer.OnboardingState> {
        // Find useful details about the state of the Gitpod installation.
        const { rows } = await this.teamDB.findTeams(
            0 /* offset */,
            1 /* limit */,
            "creationTime" /* order by */,
            "ASC",
            "" /* empty search term returns any */,
        );
        const hasAnyOrg = rows.length > 0;
        let isCompleted = false;
        for (const row of rows) {
            isCompleted = await this.teamDB.hasActiveSSO(row.id);
            if (isCompleted) {
                break;
            }
        }
        return {
            isCompleted,
            hasAnyOrg,
        };
    }

    private async guardWithFeatureFlag(flagName: string, user: User, teamId: string) {
        // Guard method w/ a feature flag check
        const isEnabled = await this.configCatClientFactory().getValueAsync(flagName, false, {
            user: user,
            teamId,
        });
        if (!isEnabled) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Method not available");
        }
    }

    public async trackEvent(ctx: TraceContext, event: RemoteTrackMessage): Promise<void> {
        // Beware: DO NOT just event... the message, but consume it individually as the message is coming from
        //         the wire and we have no idea what's in it. Even passing the context and properties directly
        //         is questionable. Considering we're handing down the msg and do not know how the analytics library
        //         handles potentially broken or malicious input, we better err on the side of caution.

        const userId = this.userID;
        const { ip, userAgent } = this.clientHeaderFields;
        const anonymousId = event.anonymousId || createCookielessId(ip, userAgent);
        const msg = {
            event: event.event,
            messageId: event.messageId,
            context: event.context,
            properties: event.properties,
        };

        //only track if at least one identifier is known
        if (userId) {
            this.analytics.track({
                userId: userId,
                anonymousId: anonymousId,
                ...msg,
            });
        } else if (anonymousId) {
            this.analytics.track({
                anonymousId: anonymousId as string | number,
                ...msg,
            });
        }
    }

    public async trackLocation(ctx: TraceContext, event: RemotePageMessage): Promise<void> {
        const userId = this.userID;
        const { ip, userAgent } = this.clientHeaderFields;
        const anonymousId = event.anonymousId || createCookielessId(ip, userAgent);
        const msg = {
            messageId: event.messageId,
            context: {},
            properties: event.properties,
        };

        //only page if at least one identifier is known
        if (userId) {
            msg.context = {
                ip: maskIp(ip),
                userAgent: userAgent,
            };
            this.analytics.page({
                userId: userId,
                anonymousId: anonymousId,
                ...msg,
            });
        } else if (anonymousId) {
            this.analytics.page({
                anonymousId: anonymousId as string | number,
                ...msg,
            });
        }
    }

    public async identifyUser(ctx: TraceContext, event: RemoteIdentifyMessage): Promise<void> {
        // traceAPIParams(ctx, { event }); tracing analytics does not make much sense

        //Identify calls collect user informmation. If the user is unknown, we don't make a call (privacy preservation)
        const user = await this.checkUser("identifyUser");
        const { ip, userAgent } = this.clientHeaderFields;
        const identifyMessage: IdentifyMessage = {
            userId: user.id,
            anonymousId: event.anonymousId || createCookielessId(ip, userAgent),
            traits: event.traits,
            context: event.context,
        };
        this.analytics.identify(identifyMessage);
    }

    async getIDEOptions(ctx: TraceContext): Promise<IDEOptions> {
        const user = await this.checkUser("identifyUser");
        const email = User.getPrimaryEmail(user);
        const ideConfig = await this.ideService.getIDEConfig({ user: { id: user.id, email } });
        return ideConfig.ideOptions;
    }

    async getSupportedWorkspaceClasses(ctx: TraceContext): Promise<SupportedWorkspaceClass[]> {
        await this.checkAndBlockUser("getSupportedWorkspaceClasses");
        const classes = this.config.workspaceClasses.map((c) => ({
            id: c.id,
            category: c.category,
            displayName: c.displayName,
            description: c.description,
            powerups: c.powerups,
            isDefault: c.isDefault,
        }));
        return classes;
    }

    //#region gitpod.io concerns
    async getLinkedInClientId(ctx: TraceContextWithSpan): Promise<string> {
        traceAPIParams(ctx, {});
        await this.checkAndBlockUser("getLinkedInClientID");
        const clientId = this.config.linkedInSecrets?.clientId;
        if (!clientId) {
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                "LinkedIn is not properly configured (no Client ID)",
            );
        }
        return clientId;
    }

    async connectWithLinkedIn(ctx: TraceContextWithSpan, code: string): Promise<LinkedInProfile> {
        traceAPIParams(ctx, { code });
        const user = await this.checkAndBlockUser("connectWithLinkedIn");
        const profile = await this.linkedInService.connectWithLinkedIn(user, code);
        return profile;
    }

    //
    //#endregion

    async reportErrorBoundary(ctx: TraceContextWithSpan, url: string, message: string): Promise<void> {
        // Cap message and url length so the entries aren't of unbounded length
        log.warn("dashboard error boundary", {
            message: (message || "").substring(0, 200),
            url: (url || "").substring(0, 200),
            userId: this.userID,
        });
        increaseDashboardErrorBoundaryCounter();
    }

    private mapGrpcError(err: Error): Error {
        function isGrpcError(err: any): err is grpc.StatusObject {
            return err.code && err.details;
        }

        if (!isGrpcError(err)) {
            return err;
        }

        switch (err.code) {
            case grpc.status.RESOURCE_EXHAUSTED:
                return new ApplicationError(ErrorCodes.TOO_MANY_REQUESTS, err.details);
            default:
                return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, err.details);
        }
    }

    private async determineWorkspaceRegion(ws: Workspace, preference: WorkspaceRegion): Promise<WorkspaceRegion> {
        const guessWorkspaceRegionEnabled = await getExperimentsClientForBackend().getValueAsync(
            "guessWorkspaceRegion",
            false,
            {
                user: { id: this.userID || "" },
            },
        );

        const regionLogContext = {
            requested_region: preference,
            client_region_from_header: this.clientHeaderFields.clientRegion,
            experiment_enabled: false,
            guessed_region: "",
        };

        let targetRegion = preference;
        if (!isWorkspaceRegion(preference)) {
            targetRegion = "";
        } else {
            targetRegion = preference;
        }

        if (guessWorkspaceRegionEnabled) {
            regionLogContext.experiment_enabled = true;

            if (!preference) {
                // Attempt to identify the region based on LoadBalancer headers, if there was no explicit choice on the request.
                // The Client region contains the two letter country code.
                if (this.clientHeaderFields.clientRegion) {
                    const countryCode = this.clientHeaderFields.clientRegion;

                    targetRegion = RegionService.countryCodeToNearestWorkspaceRegion(countryCode);
                    regionLogContext.guessed_region = targetRegion;
                }
            }
        }

        const logCtx = { userId: this.userID, workspaceId: ws.id };
        log.info(logCtx, "[guessWorkspaceRegion] Workspace with region selection", regionLogContext);

        return targetRegion;
    }

    async getIDToken(): Promise<void> {}

    public async controlAdmission(ctx: TraceContext, workspaceId: string, level: "owner" | "everyone"): Promise<void> {
        traceAPIParams(ctx, { workspaceId, level });
        traceWI(ctx, { workspaceId });

        const user = await this.checkAndBlockUser("controlAdmission");

        const lvlmap = new Map<string, AdmissionLevel>();
        lvlmap.set("owner", AdmissionLevel.ADMIT_OWNER_ONLY);
        lvlmap.set("everyone", AdmissionLevel.ADMIT_EVERYONE);
        if (!lvlmap.has(level)) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Invalid admission level.");
        }

        const workspace = await this.internalGetWorkspace(user, workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");

        if (level != "owner" && workspace.organizationId) {
            const settings = await this.organizationService.getSettings(user.id, workspace.organizationId);
            if (settings?.workspaceSharingDisabled) {
                throw new ApplicationError(
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
        await this.checkAndBlockUser("getStripePublishableKey");
        const publishableKey = this.config.stripeSecrets?.publishableKey;
        if (!publishableKey) {
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                "Stripe is not properly configured (no publishable key)",
            );
        }
        return publishableKey;
    }

    async findStripeSubscriptionId(ctx: TraceContext, attributionId: string): Promise<string | undefined> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        try {
            await this.guardTeamOperation(attrId.teamId, "get", "read_billing");
            const subscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(attributionId);
            return subscriptionId;
        } catch (error) {
            log.error(`Failed to get Stripe Subscription ID for '${attributionId}'`, error);
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to get Stripe Subscription ID for '${attributionId}'`,
            );
        }
    }

    async getPriceInformation(ctx: TraceContext, attributionId: string): Promise<string | undefined> {
        const attrId = AttributionId.parse(attributionId);
        if (!attrId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attributionId '${attributionId}'`);
        }

        await this.guardTeamOperation(attrId.teamId, "update", "write_billing");
        return this.stripeService.getPriceInformation(attributionId);
    }

    async createStripeCustomerIfNeeded(ctx: TraceContext, attributionId: string, currency: string): Promise<void> {
        const user = await this.checkAndBlockUser("createStripeCustomerIfNeeded");
        const attrId = AttributionId.parse(attributionId);
        if (!attrId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attributionId '${attributionId}'`);
        }

        const org = (await this.guardTeamOperation(attrId.teamId, "update", "write_billing")).team;

        //TODO billing email should be editable within the org
        const billingEmail = User.getPrimaryEmail(user);
        const billingName = org.name;

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
                throw new ApplicationError(
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
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to create Stripe customer profile for '${attributionId}'`,
            );
        }
    }

    async createHoldPaymentIntent(
        ctx: TraceContext,
        attributionId: string,
    ): Promise<{ paymentIntentId: string; paymentIntentClientSecret: string }> {
        await this.checkAndBlockUser("createHoldPaymentIntent");

        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        await this.guardTeamOperation(attrId.teamId, "update", "write_billing");

        try {
            const response = await this.billingService.createHoldPaymentIntent({ attributionId: attributionId });
            return {
                paymentIntentId: response.paymentIntentId,
                paymentIntentClientSecret: response.paymentIntentClientSecret,
            };
        } catch (error) {
            log.error(`Failed to subscribe '${attributionId}' to Stripe`, error);
            if (error instanceof ClientError) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, error.details);
            }
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to subscribe '${attributionId}' to Stripe`,
            );
        }
    }

    async subscribeToStripe(
        ctx: TraceContext,
        attributionId: string,
        paymentIntentId: string,
        usageLimit: number,
    ): Promise<number | undefined> {
        const user = await this.checkAndBlockUser("subscribeToStripe");
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        try {
            await this.guardTeamOperation(attrId.teamId, "update", "write_billing");

            const customerId = await this.stripeService.findCustomerByAttributionId(attributionId);
            if (!customerId) {
                throw new Error(`No Stripe customer profile for '${attributionId}'`);
            }

            await this.billingService.createStripeSubscription({
                attributionId,
                paymentIntentId,
                usageLimit,
            });

            // Creating a cost center for this customer
            // TODO stripe should be the authority to change the billing strategy. On subscribe -> set to stripe, on unsubscribe -> set to other
            await this.usageService.subscribeToStripe(user.id, attrId.teamId, usageLimit);
            const costCenter = await this.usageService.getCostCenter(user.id, attrId.teamId);
            // marking all members as verified
            try {
                await this.verificationService.verifyOrgMembers(attrId.teamId);
            } catch (err) {
                log.error(`Failed to verify org members`, err, { organizationId: attrId.teamId });
            }

            return costCenter.spendingLimit;
        } catch (error) {
            log.error(`Failed to subscribe '${attributionId}' to Stripe`, error);
            if (error instanceof ClientError) {
                throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, error.details);
            }
            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                `Failed to subscribe '${attributionId}' to Stripe`,
            );
        }
    }

    async getStripePortalUrl(ctx: TraceContext, attributionId: string): Promise<string> {
        await this.checkAndBlockUser("getStripePortalUrl");

        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const returnUrl = this.config.hostUrl
            .with(() => ({ pathname: `/billing`, search: `org=${attrId.kind === "team" ? attrId.teamId : "0"}` }))
            .toString();
        await this.guardTeamOperation(attrId.teamId, "update", "write_billing");
        let url: string;
        try {
            url = await this.stripeService.getPortalUrlForAttributionId(attributionId, returnUrl);
        } catch (error) {
            log.error(`Failed to get Stripe portal URL for '${attributionId}'`, error);
            throw new ApplicationError(
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
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const user = await this.checkAndBlockUser("getCostCenter");
        await this.guardCostCenterAccess(ctx, attrId, "get", "read_billing");

        return await this.usageService.getCostCenter(user.id, attrId.teamId);
    }

    async setUsageLimit(ctx: TraceContext, attributionId: string, usageLimit: number): Promise<void> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }
        if (typeof usageLimit !== "number" || usageLimit < 0) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Unexpected usageLimit value: ${usageLimit}`);
        }
        const user = await this.checkAndBlockUser("setUsageLimit");
        await this.guardCostCenterAccess(ctx, attrId, "update", "write_billing");

        await this.usageService.setUsageLimit(user.id, attrId.teamId, usageLimit);
    }

    async listUsage(ctx: TraceContext, req: ListUsageRequest): Promise<ListUsageResponse> {
        const attributionId = AttributionId.parse(req.attributionId);
        if (!attributionId) {
            throw new ApplicationError(ErrorCodes.INVALID_COST_CENTER, "Bad attribution ID", {
                attributionId: req.attributionId,
            });
        }
        const user = await this.checkAndBlockUser("listUsage");
        await this.guardCostCenterAccess(ctx, attributionId, "get", "not_implemented");
        return this.usageService.listUsage(user.id, req);
    }

    async getUsageBalance(ctx: TraceContext, attributionId: string): Promise<number> {
        const user = await this.checkAndBlockUser("listUsage");
        const parsedAttributionId = AttributionId.parse(attributionId);
        if (!parsedAttributionId) {
            throw new ApplicationError(ErrorCodes.INVALID_COST_CENTER, "Bad attribution ID", {
                attributionId,
            });
        }
        await this.guardCostCenterAccess(ctx, parsedAttributionId, "get", "read_billing");
        const result = await this.usageService.getCurrentBalance(user.id, parsedAttributionId.teamId);
        return result.usedCredits;
    }

    private async guardCostCenterAccess(
        ctx: TraceContext,
        attributionId: AttributionId,
        operation: ResourceAccessOp,
        fineGrainedOp: OrganizationPermission | "not_implemented",
    ): Promise<{ team: Team; members: TeamMemberInfo[] }> {
        if (attributionId.kind !== "team") {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid attributionId");
        }

        return await this.guardTeamOperation(attributionId.teamId, operation, fineGrainedOp);
    }

    async getBillingModeForUser(ctx: TraceContextWithSpan): Promise<BillingMode> {
        traceAPIParams(ctx, {});

        const user = await this.checkUser("getBillingModeForUser");
        return this.billingModes.getBillingModeForUser(user, new Date());
    }

    async getBillingModeForTeam(ctx: TraceContextWithSpan, teamId: string): Promise<BillingMode> {
        traceAPIParams(ctx, { teamId });

        const user = await this.checkAndBlockUser("getBillingModeForTeam");
        await this.guardTeamOperation(teamId, "get", "not_implemented");

        return this.billingModes.getBillingMode(user.id, teamId, new Date());
    }

    // (SaaS) – admin
    async adminGetBillingMode(ctx: TraceContextWithSpan, attributionId: string): Promise<BillingMode> {
        traceAPIParams(ctx, { attributionId });

        const user = await this.checkAndBlockUser("adminGetBillingMode");
        if (!this.authorizationService.hasPermission(user, Permission.ADMIN_USERS)) {
            throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }

        const parsedAttributionId = AttributionId.parse(attributionId);
        if (!parsedAttributionId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Unable to parse attributionId");
        }
        return this.billingModes.getBillingMode(user.id, parsedAttributionId.teamId, new Date());
    }

    async adminGetCostCenter(ctx: TraceContext, attributionId: string): Promise<CostCenterJSON | undefined> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }

        const user = await this.checkAndBlockUser("adminGetCostCenter");
        await this.guardAdminAccess("adminGetCostCenter", { id: user.id }, Permission.ADMIN_USERS);

        return await this.usageService.getCostCenter(user.id, attrId.teamId);
    }

    async adminSetUsageLimit(ctx: TraceContext, attributionId: string, usageLimit: number): Promise<void> {
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }
        const adminUser = await this.checkAndBlockUser("adminSetUsageLimit");
        await this.guardAdminAccess("adminSetUsageLimit", { id: adminUser.id }, Permission.ADMIN_USERS);

        await this.usageService.setUsageLimit(adminUser.id, attrId.teamId, usageLimit);
    }

    async adminListUsage(ctx: TraceContext, req: ListUsageRequest): Promise<ListUsageResponse> {
        traceAPIParams(ctx, { req });
        const adminUser = await this.checkAndBlockUser("adminListUsage");
        await this.guardAdminAccess("adminListUsage", { id: adminUser.id }, Permission.ADMIN_USERS);
        return this.usageService.listUsage(adminUser.id, req);
    }

    async adminGetUsageBalance(ctx: TraceContext, attributionId: string): Promise<number> {
        traceAPIParams(ctx, { attributionId });
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }
        const user = await this.checkAndBlockUser("adminGetUsageBalance");
        await this.guardAdminAccess("adminGetUsageBalance", { id: user.id }, Permission.ADMIN_USERS);
        const result = await this.usageService.getCurrentBalance(user.id, attrId.teamId);
        return result.usedCredits;
    }

    async adminAddUsageCreditNote(
        ctx: TraceContext,
        attributionId: string,
        credits: number,
        description: string,
    ): Promise<void> {
        traceAPIParams(ctx, { attributionId, credits, note: description });
        const attrId = AttributionId.parse(attributionId);
        if (attrId === undefined) {
            log.error(`Invalid attribution id: ${attributionId}`);
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, `Invalid attibution id: ${attributionId}`);
        }
        const user = await this.checkAndBlockUser("adminAddUsageCreditNote");
        await this.guardAdminAccess("adminAddUsageCreditNote", { id: user.id }, Permission.ADMIN_USERS);
        await this.usageService.addCreditNote(user.id, attrId.teamId, credits, description);
    }

    async adminGetBlockedEmailDomains(ctx: TraceContextWithSpan): Promise<EmailDomainFilterEntry[]> {
        const user = await this.checkAndBlockUser("adminGetBlockedEmailDomains");
        await this.guardAdminAccess("adminGetBlockedEmailDomains", { id: user.id }, Permission.ADMIN_USERS);
        return await this.emailDomainFilterdb.getFilterEntries();
    }

    async adminSaveBlockedEmailDomain(
        ctx: TraceContextWithSpan,
        domainFilterentry: EmailDomainFilterEntry,
    ): Promise<void> {
        const user = await this.checkAndBlockUser("adminSaveBlockedEmailDomain");
        await this.guardAdminAccess("adminSaveBlockedEmailDomain", { id: user.id }, Permission.ADMIN_USERS);
        await this.emailDomainFilterdb.storeFilterEntry(domainFilterentry);
    }
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    DownloadUrlRequest,
    DownloadUrlResponse,
    UploadUrlRequest,
    UploadUrlResponse,
} from "@gitpod/content-service/lib/blobs_pb";
import {
    AppInstallationDB,
    UserDB,
    WorkspaceDB,
    DBWithTracing,
    TracedWorkspaceDB,
    DBGitpodToken,
    DBUser,
    UserStorageResourcesDB,
    TeamDB,
    InstallationAdminDB,
    ProjectDB,
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
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
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
import { ImageBuilderClientProvider } from "@gitpod/image-builder/lib";
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
import { Disposable, ResponseError } from "vscode-jsonrpc";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { AuthProviderService } from "../auth/auth-provider-service";
import { HostContextProvider } from "../auth/host-context-provider";
import { GuardedCostCenter, GuardedResource, ResourceAccessGuard, ResourceAccessOp } from "../auth/resource-access";
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
import { WorkspaceStarter } from "./workspace-starter";
import { HeadlessLogUrls } from "@gitpod/gitpod-protocol/lib/headless-workspace-log";
import { HeadlessLogService, HeadlessLogEndpoint } from "./headless-log-service";
import { ConfigProvider, InvalidGitpodYMLError } from "./config-provider";
import { ProjectsService } from "../projects/projects-service";
import { LocalMessageBroker } from "../messaging/local-message-broker";
import { IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { PartialProject, OrganizationSettings } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { ClientMetadata, traceClientMetadata } from "../websocket/websocket-connection-manager";
import {
    AdditionalUserData,
    EnvVarWithValue,
    LinkedInProfile,
    OpenPrebuildContext,
    ProjectEnvVar,
    UserFeatureSettings,
    WorkspaceTimeoutSetting,
} from "@gitpod/gitpod-protocol/lib/protocol";
import { InstallationAdminSettings, TelemetryData } from "@gitpod/gitpod-protocol";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { InstallationAdminTelemetryDataProvider } from "../installation-admin/telemetry-data-provider";
import { ListUsageRequest, ListUsageResponse } from "@gitpod/gitpod-protocol/lib/usage";
import { VerificationService } from "../auth/verification-service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { EntitlementService, MayStartWorkspaceResult } from "../billing/entitlement-service";
import { formatPhoneNumber } from "../user/phone-numbers";
import { IDEService } from "../ide-service";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import * as grpc from "@grpc/grpc-js";
import { CachingBlobServiceClientProvider } from "../util/content-service-sugar";
import { CostCenterJSON } from "@gitpod/gitpod-protocol/lib/usage";
import { createCookielessId, maskIp } from "../analytics";
import {
    ConfigCatClientFactory,
    getExperimentsClientForBackend,
} from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import {
    Authorizer,
    CheckResult,
    OrganizationOperation,
    NotPermitted,
    PermissionChecker,
} from "../authorization/perms";
import {
    ReadOrganizationMembers,
    ReadOrganizationMetadata,
    WriteOrganizationMembers,
    WriteOrganizationMetadata,
} from "../authorization/checks";
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
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";
import { StripeService } from "../user/stripe-service";
import { UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import {
    BillingServiceClient,
    BillingServiceDefinition,
    StripeCustomer,
} from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import {
    CostCenter,
    CostCenter_BillingStrategy,
    ListUsageRequest_Ordering,
    UsageServiceClient,
    Usage_Kind,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { ClientError } from "nice-grpc-common";
import { BillingModes } from "../billing/billing-mode";
import { goDurationToHumanReadable } from "@gitpod/gitpod-protocol/lib/util/timeutil";

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
    @inject(Config) protected readonly config: Config;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(WorkspaceFactory) protected readonly workspaceFactory: WorkspaceFactory;
    @inject(WorkspaceDeletionService) protected readonly workspaceDeletionService: WorkspaceDeletionService;
    @inject(LocalMessageBroker) protected readonly localMessageBroker: LocalMessageBroker;
    @inject(ContextParser) protected contextParser: ContextParser;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(GitpodFileParser) protected readonly gitpodParser: GitpodFileParser;
    @inject(InstallationAdminDB) protected readonly installationAdminDb: InstallationAdminDB;
    @inject(InstallationAdminTelemetryDataProvider)
    protected readonly telemetryDataProvider: InstallationAdminTelemetryDataProvider;

    @inject(GitHubAppSupport) protected readonly githubAppSupport: GitHubAppSupport;
    @inject(GitLabAppSupport) protected readonly gitLabAppSupport: GitLabAppSupport;
    @inject(BitbucketAppSupport) protected readonly bitbucketAppSupport: BitbucketAppSupport;

    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(IncrementalPrebuildsService) protected readonly incrementalPrebuildsService: IncrementalPrebuildsService;
    @inject(ConfigProvider) protected readonly configProvider: ConfigProvider;
    @inject(WorkspaceStarter) protected readonly workspaceStarter: WorkspaceStarter;
    @inject(SnapshotService) protected readonly snapshotService: SnapshotService;
    @inject(WorkspaceManagerClientProvider)
    protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;
    @inject(ImageBuilderClientProvider) protected imagebuilderClientProvider: ImageBuilderClientProvider;

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(BlockedRepositoryDB) protected readonly blockedRepostoryDB: BlockedRepositoryDB;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(UserService) protected readonly userService: UserService;
    @inject(UserStorageResourcesDB) protected readonly userStorageResourcesDB: UserStorageResourcesDB;
    @inject(UserDeletionService) protected readonly userDeletionService: UserDeletionService;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(AuthorizationService) protected readonly authorizationService: AuthorizationService;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(LinkedInService) protected readonly linkedInService: LinkedInService;

    @inject(AppInstallationDB) protected readonly appInstallationDB: AppInstallationDB;

    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;

    @inject(CachingBlobServiceClientProvider)
    protected readonly blobServiceClientProvider: CachingBlobServiceClientProvider;

    @inject(GitTokenScopeGuesser) protected readonly gitTokenScopeGuesser: GitTokenScopeGuesser;

    @inject(HeadlessLogService) protected readonly headlessLogService: HeadlessLogService;

    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(ProjectsService) protected readonly projectsService: ProjectsService;

    @inject(IDEService) protected readonly ideService: IDEService;

    @inject(VerificationService) protected readonly verificationService: VerificationService;
    @inject(EntitlementService) protected readonly entitlementService: EntitlementService;

    @inject(ConfigCatClientFactory) protected readonly configCatClientFactory: ConfigCatClientFactory;

    @inject(PermissionChecker) protected readonly authorizer: Authorizer;

    @inject(BillingModes) protected readonly billingModes: BillingModes;
    @inject(StripeService) protected readonly stripeService: StripeService;
    @inject(UsageServiceDefinition.name) protected readonly usageService: UsageServiceClient;
    @inject(BillingServiceDefinition.name) protected readonly billingService: BillingServiceClient;

    @inject(EnvVarService)
    private readonly envVarService: EnvVarService;

    @inject(UserToTeamMigrationService)
    private readonly userToTeamMigrationService: UserToTeamMigrationService;

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

    initialize(
        client: GitpodApiClient | undefined,
        user: User | undefined,
        accessGuard: ResourceAccessGuard,
        clientMetadata: ClientMetadata,
        connectionCtx: TraceContext | undefined,
        clientHeaderFields: ClientHeaderFields,
    ): void {
        if (client) {
            this.disposables.push(Disposable.create(() => (this.client = undefined)));
        }
        this.client = client;
        this.user = user;
        this.resourceAccessGuard = accessGuard;
        this.clientHeaderFields = clientHeaderFields;
        (this.clientMetadata as any) = clientMetadata;
        this.connectionCtx = connectionCtx;

        log.debug({ userId: this.user?.id }, `clientRegion: ${clientHeaderFields.clientRegion}`);
        log.debug({ userId: this.user?.id }, "initializeClient");

        this.listenForWorkspaceInstanceUpdates();

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

    protected listenForWorkspaceInstanceUpdates(): void {
        if (!this.user || !this.client) {
            return;
        }

        // TODO(cw): the instance update is not subject to resource access guards, hence provides instance info
        //           to clients who might not otherwise have access to that information.
        this.disposables.push(
            this.localMessageBroker.listenForWorkspaceInstanceUpdates(this.user.id, (ctx, instance) =>
                this.forwardInstanceUpdateToClient(ctx, instance),
            ),
        );
    }

    protected forwardInstanceUpdateToClient(ctx: TraceContext, instance: WorkspaceInstance) {
        // gpl: We decided against tracing updates here, because it create far too much noise (cmp. history)
        this.client?.onInstanceUpdate(this.censorInstance(instance));
    }

    setClient(ctx: TraceContext, client: GitpodApiClient | undefined): void {
        throw new Error("Unsupported operation. Use initialize.");
    }

    protected async guardAccess(resource: GuardedResource, op: ResourceAccessOp) {
        if (!(await this.resourceAccessGuard.canAccess(resource, op))) {
            throw new ResponseError(
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
    protected censorInstance<T extends WorkspaceInstance | undefined>(wsi: T): T {
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

    protected checkUser(methodName?: string, logPayload?: {}, ctx?: LogContext): User {
        // Generally, a user session is required.
        if (!this.user) {
            throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "User is not authenticated. Please login.");
        }
        if (this.user.markedDeleted === true) {
            throw new ResponseError(ErrorCodes.USER_DELETED, "User has been deleted.");
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
            log.debug(userContext, `${methodName || "checkAndBlockUser"}: blocked`, payload);
            throw new ResponseError(ErrorCodes.USER_BLOCKED, "You've been blocked.");
        }
        return user;
    }

    public async getLoggedInUser(ctx: TraceContext): Promise<User> {
        await this.doUpdateUser();
        return this.checkUser("getLoggedInUser");
    }

    protected enableDedicatedOnboardingFlow: boolean = false; // TODO(gpl): Remove once we have an onboarding setup
    protected async doUpdateUser(): Promise<void> {
        // Conditionally enable Dedicated Onboarding Flow
        this.enableDedicatedOnboardingFlow = await this.configCatClientFactory().getValueAsync(
            "enableDedicatedOnboardingFlow",
            false,
            {
                gitpodHost: new URL(this.config.hostUrl.toString()).host,
            },
        );

        if (this.user) {
            if (this.userToTeamMigrationService.needsMigration(this.user)) {
                this.user = await this.userToTeamMigrationService.migrateUser(this.user, true, "on demand");
            }
            let updatedUser = await this.userDB.findUserById(this.user.id);
            if (updatedUser) {
                this.user = updatedUser;
            }
        }
    }

    public async updateLoggedInUser(ctx: TraceContext, update: Partial<User>): Promise<User> {
        traceAPIParams(ctx, {}); // partialUser contains PII

        const user = this.checkUser("updateLoggedInUser");
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
        const user = this.checkUser("maySetTimeout");
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

        const user = this.checkAndBlockUser("updateWorkspaceTimeoutSetting");
        await this.guardAccess({ kind: "user", subject: user }, "update");

        if (!(await this.entitlementService.maySetTimeout(user, new Date()))) {
            throw new Error("configure workspace timeout only available for paid user.");
        }

        AdditionalUserData.set(user, setting);
        await this.userDB.updateUserPartial(user);
    }

    public async sendPhoneNumberVerificationToken(ctx: TraceContext, rawPhoneNumber: string): Promise<void> {
        this.checkUser("sendPhoneNumberVerificationToken");
        return this.verificationService.sendVerificationToken(formatPhoneNumber(rawPhoneNumber));
    }

    public async verifyPhoneNumberVerificationToken(
        ctx: TraceContext,
        rawPhoneNumber: string,
        token: string,
    ): Promise<boolean> {
        const phoneNumber = formatPhoneNumber(rawPhoneNumber);
        const user = this.checkUser("verifyPhoneNumberVerificationToken");
        const checked = await this.verificationService.verifyVerificationToken(phoneNumber, token);
        if (!checked) {
            return false;
        }
        this.verificationService.markVerified(user);
        user.verificationPhoneNumber = phoneNumber;
        await this.userDB.updateUserPartial(user);
        return true;
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
        const authProviders = hostContexts.map((hc) => hc.authProvider.info);

        const isBuiltIn = (info: AuthProviderInfo) => !info.ownerId;
        const isNotHidden = (info: AuthProviderInfo) => !info.hiddenOnDashboard;
        const isVerified = (info: AuthProviderInfo) => info.verified;
        const isNotOrgProvider = (info: AuthProviderInfo) => !info.organizationId;

        // if no user session is available, compute public information only
        if (!this.user) {
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

        // otherwise show all the details
        const result: AuthProviderInfo[] = [];
        for (const info of authProviders) {
            const identity = this.user.identities.find((i) => i.authProviderId === info.authProviderId);
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
            isSingleOrgInstallation: this.config.isSingleOrgInstallation,
        };
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

    public async deleteAccount(ctx: TraceContext): Promise<void> {
        const user = this.checkAndBlockUser("deleteAccount");
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

        this.checkUser("getWorkspace");

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
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

        this.checkAndBlockUser("getOwnerToken");

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

        this.checkAndBlockUser("getIDECredentials");

        const workspace = await this.workspaceDb.trace(ctx).findById(workspaceId);
        if (!workspace) {
            throw new Error("workspace not found");
        }
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        if (workspace.config.ideCredentials) {
            return workspace.config.ideCredentials;
        }
        return this.workspaceDb.trace(ctx).transaction(async (db) => {
            const ws = await this.internalGetWorkspace(workspaceId, db);
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

        const user = this.checkAndBlockUser("startWorkspace", undefined, { workspaceId });

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
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
        const envVarsPromise = this.envVarService.resolve(workspace);
        const projectPromise = workspace.projectId
            ? this.projectDB.findProjectById(workspace.projectId)
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

        const user = this.checkUser("stopWorkspace", undefined, { workspaceId });
        const logCtx = { userId: user.id, workspaceId };

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        if (workspace.type === "prebuild") {
            // If this is a team prebuild, any team member can stop it.
            const teamMembers = await this.getTeamMembersByProject(workspace.projectId);
            await this.guardAccess({ kind: "workspace", subject: workspace, teamMembers }, "get");
        } else {
            // If this is not a prebuild, or it's a personal prebuild, only the workspace owner can stop it.
            await this.guardAccess({ kind: "workspace", subject: workspace }, "get");
        }

        this.internalStopWorkspace(ctx, workspace, "stopped via API").catch((err) => {
            log.error(logCtx, "stopWorkspace error: ", err);
        });
    }

    protected async internalStopWorkspace(
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

    protected async guardAdminAccess(method: string, params: any, requiredPermission: PermissionName) {
        const user = this.checkAndBlockUser(method);
        if (!this.authorizationService.hasPermission(user, requiredPermission)) {
            log.warn({ userId: this.user?.id }, "unauthorised admin access", { authorised: false, method, params });
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "not allowed");
        }
        log.info({ userId: this.user?.id }, "admin access", { authorised: true, method, params });
    }

    public async updateWorkspaceUserPin(
        ctx: TraceContext,
        workspaceId: string,
        action: "pin" | "unpin" | "toggle",
    ): Promise<void> {
        traceAPIParams(ctx, { workspaceId, action });
        traceWI(ctx, { workspaceId });

        this.checkAndBlockUser("updateWorkspaceUserPin");

        await this.workspaceDb.trace(ctx).transaction(async (db) => {
            const ws = await this.internalGetWorkspace(workspaceId, db);
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

        this.checkAndBlockUser("deleteWorkspace");

        const ws = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: ws }, "delete");

        // for good measure, try and stop running instances
        await this.internalStopWorkspace(ctx, ws, "deleted via API");

        // actually delete the workspace
        await this.workspaceDeletionService.softDeleteWorkspace(ctx, ws, "user");
    }

    public async setWorkspaceDescription(ctx: TraceContext, workspaceId: string, description: string): Promise<void> {
        traceAPIParams(ctx, { workspaceId, description });
        traceWI(ctx, { workspaceId });

        this.checkAndBlockUser("setWorkspaceDescription");

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));

        await this.guardAccess({ kind: "workspace", subject: workspace }, "update");
        await this.workspaceDb.trace(ctx).updatePartial(workspaceId, { description });
    }

    public async getWorkspaces(
        ctx: TraceContext,
        options: GitpodServer.GetWorkspacesOptions,
    ): Promise<WorkspaceInfo[]> {
        traceAPIParams(ctx, { options });

        const user = this.checkUser("getWorkspaces");

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

        // we need to update old workspaces on the fly that didn't get an orgId because we lack attribution on their instances.
        // this can be removed eventually.
        if (user.additionalData?.isMigratedToTeamOnlyAttribution) {
            try {
                const userOrg = await this.userToTeamMigrationService.getUserOrganization(user);
                await this.userToTeamMigrationService.updateWorkspacesOrganizationId(res, userOrg.id);
            } catch (error) {
                log.error({ userId: user.id }, "Error updating workspaces without orgId.", error);
            }
        }
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

        this.checkAndBlockUser("getWorkspaceUsers", undefined, { workspaceId });

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
        await this.guardAccess({ kind: "workspace", subject: workspace }, "get");

        // Note: there's no need to try and guard the users below, they're not complete users but just enough to
        //       to support the workspace sharing. The access guard above is enough.
        return await this.workspaceDb
            .trace(ctx)
            .getWorkspaceUsers(workspaceId, this.config.workspaceHeartbeat.timeoutSeconds * 1000);
    }

    protected async internalGetWorkspace(id: string, db: WorkspaceDB): Promise<Workspace> {
        const workspace = await db.findById(id);
        if (!workspace) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Workspace not found.");
        }
        if (!workspace.organizationId && this.user?.additionalData?.isMigratedToTeamOnlyAttribution) {
            try {
                log.info({ userId: this.user.id }, "Updating workspace without orgId.");
                const userOrg = await this.userToTeamMigrationService.getUserOrganization(this.user);
                const latestInstance = await this.workspaceDb.trace({}).findCurrentInstance(workspace.id);
                await this.userToTeamMigrationService.updateWorkspacesOrganizationId(
                    [{ workspace, latestInstance }],
                    userOrg.id,
                );
            } catch (error) {
                log.error({ userId: this.user.id }, "Error updating workspaces without orgId.", error);
            }
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
            const user = this.checkAndBlockUser("createWorkspace", { options });

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
                }).catch();
                const snapshot = await this.workspaceDb.trace(ctx).findSnapshotById(context.snapshotId);
                if (!snapshot) {
                    throw new ResponseError(
                        ErrorCodes.NOT_FOUND,
                        "No snapshot with id '" + context.snapshotId + "' found.",
                    );
                }
                const workspace = await this.workspaceDb.trace(ctx).findById(snapshot.originalWorkspaceId);
                if (!workspace) {
                    throw new ResponseError(
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
                    }).catch();
                    if (UnauthorizedError.is(error)) {
                        throw error;
                    }
                    throw new ResponseError(
                        ErrorCodes.PERMISSION_DENIED,
                        `Snapshot URLs require read access to the underlying repository. Please request access from the repository owner.`,
                    );
                }
                this.trackEvent(ctx, {
                    event: "snapshot_access_granted",
                    properties: { snapshot_id: context.snapshotId },
                }).catch();
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
                ? await this.projectDB.findProjectByCloneUrl(context.repository.cloneUrl)
                : undefined;

            let organizationId = options.organizationId;
            if (!organizationId) {
                if (!user.additionalData?.isMigratedToTeamOnlyAttribution) {
                    const attributionId = await this.userService.getWorkspaceUsageAttributionId(user, project?.id);
                    organizationId = attributionId.kind === "team" ? attributionId.teamId : undefined;
                } else {
                    throw new ResponseError(ErrorCodes.BAD_REQUEST, "No organizationId provided.");
                }
            }
            const mayStartWorkspacePromise = this.mayStartWorkspace(ctx, user, organizationId, runningInstancesPromise);

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

            try {
                await mayStartWorkspacePromise;
            } catch (error) {
                // if the user is not migrated, yet, and the selected organization doesn't have credits, we fall back to what is set on the user preferences
                // can be deleted when everyone is migrated
                if (
                    !user.additionalData?.isMigratedToTeamOnlyAttribution &&
                    error instanceof ResponseError &&
                    error.code === ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED
                ) {
                    const attributionId = await this.userService.getWorkspaceUsageAttributionId(user, project?.id);
                    organizationId = attributionId.kind === "team" ? attributionId.teamId : undefined;
                    // verify again with the updated organizationId
                    await this.mayStartWorkspace(ctx, user, organizationId, runningInstancesPromise);
                } else {
                    throw error;
                }
            }
            const workspace = await this.workspaceFactory.createForContext(
                ctx,
                user,
                organizationId,
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
        const user = this.checkAndBlockUser("resolveContext");
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
        throw new ResponseError(
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
            } catch {}
        }
        return undefined;
    }

    protected async pollDatabaseUntilPrebuildIsAvailable(
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

    protected async mayStartWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string | undefined,
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
            throw new ResponseError(ErrorCodes.NEEDS_VERIFICATION, `Please verify your account.`);
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

    public async getFeaturedRepositories(ctx: TraceContext): Promise<WhitelistedRepository[]> {
        const user = this.checkAndBlockUser("getFeaturedRepositories");
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
        const user = this.checkAndBlockUser("getSuggestedContextURLs");
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
            humanReadableDuration: goDurationToHumanReadable(validatedDuration),
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

        this.checkAndBlockUser("getOpenPorts");

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

        const user = this.checkAndBlockUser("openPort");

        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
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

    protected portVisibilityFromProto(visibility: ProtoPortVisibility): PortVisibility {
        switch (visibility) {
            default: // the default in the protobuf def is: private
            case ProtoPortVisibility.PORT_VISIBILITY_PRIVATE:
                return "private";
            case ProtoPortVisibility.PORT_VISIBILITY_PUBLIC:
                return "public";
        }
    }

    protected portVisibilityToProto(visibility: PortVisibility | undefined): ProtoPortVisibility {
        switch (visibility) {
            default: // the default for requests is: private
            case "private":
                return ProtoPortVisibility.PORT_VISIBILITY_PRIVATE;
            case "public":
                return ProtoPortVisibility.PORT_VISIBILITY_PUBLIC;
        }
    }

    protected portProtocolFromProto(protocol: ProtoPortProtocol): PortProtocol {
        switch (protocol) {
            default: // the default in the protobuf def is: http
            case ProtoPortProtocol.PORT_PROTOCOL_HTTP:
                return "http";
            case ProtoPortProtocol.PORT_PROTOCOL_HTTPS:
                return "https";
        }
    }

    protected portProtocolToProto(protocol: PortProtocol | undefined): ProtoPortProtocol {
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

        const user = this.checkAndBlockUser("closePort");

        const { workspace, instance } = await this.internGetCurrentWorkspaceInstance(ctx, workspaceId);
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

        const user = this.checkAndBlockUser("watchWorkspaceImageBuildLogs", undefined, { workspaceId });
        const client = this.client;
        if (!client) {
            return;
        }

        const logCtx: LogContext = { userId: user.id, workspaceId };
        let { instance, workspace } = await this.internGetCurrentWorkspaceInstance(ctx, workspaceId);
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
            throw new ResponseError(
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
            throw new ResponseError(
                ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE,
                "cannot watch imagebuild logs for workspaceId",
            );
        } finally {
            aborted.resolve(false);
        }
    }

    async getHeadlessLog(ctx: TraceContext, instanceId: string): Promise<HeadlessLogUrls> {
        traceAPIParams(ctx, { instanceId });

        this.checkAndBlockUser("getHeadlessLog", { instanceId });
        const logCtx: LogContext = { instanceId };

        const ws = await this.workspaceDb.trace(ctx).findByInstanceId(instanceId);
        if (!ws) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Workspace ${instanceId} not found`);
        }

        const wsiPromise = this.workspaceDb.trace(ctx).findInstanceById(instanceId);
        const teamMembers = await this.getTeamMembersByProject(ws.projectId);

        await this.guardAccess({ kind: "workspaceLog", subject: ws, teamMembers }, "get");

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

    protected async internGetCurrentWorkspaceInstance(
        ctx: TraceContext,
        workspaceId: string,
    ): Promise<{ workspace: Workspace; instance: WorkspaceInstance | undefined }> {
        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));

        const instance = await this.workspaceDb.trace(ctx).findRunningInstance(workspaceId);
        return { instance, workspace };
    }

    async getUserStorageResource(
        ctx: TraceContext,
        options: GitpodServer.GetUserStorageResourceOptions,
    ): Promise<string> {
        traceAPIParams(ctx, { options });

        const uri = options.uri;
        const userId = this.checkUser("getUserStorageResource", { uri: options.uri }).id;

        await this.guardAccess({ kind: "userStorage", uri, userID: userId }, "get");

        return await this.userStorageResourcesDB.get(userId, uri);
    }

    async updateUserStorageResource(
        ctx: TraceContext,
        options: GitpodServer.UpdateUserStorageResourceOptions,
    ): Promise<void> {
        traceAPIParams(ctx, { options: censor(options, "content") }); // because may contain PII, and size (arbitrary files are stored here)

        const { uri, content } = options;
        const userId = this.checkAndBlockUser("updateUserStorageResource", { uri: options.uri }).id;

        await this.guardAccess({ kind: "userStorage", uri, userID: userId }, "update");

        await this.userStorageResourcesDB.update(userId, uri, content);
    }

    async isGitHubAppEnabled(ctx: TraceContext): Promise<boolean> {
        this.checkAndBlockUser();
        return !!this.config.githubApp?.enabled;
    }

    async registerGithubApp(ctx: TraceContext, installationId: string): Promise<void> {
        traceAPIParams(ctx, { installationId });

        const user = this.checkAndBlockUser();

        if (!this.config.githubApp?.enabled) {
            throw new ResponseError(
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

    protected async internalDoWaitForWorkspace(opts: WaitForSnapshotOptions) {
        try {
            await this.snapshotService.waitForSnapshot(opts);
        } catch (err) {
            // wrap in SNAPSHOT_ERROR to signal this call should not be retried.
            throw new ResponseError(ErrorCodes.SNAPSHOT_ERROR, err.toString());
        }
    }

    async getWorkspaceEnvVars(ctx: TraceContext, workspaceId: string): Promise<EnvVarWithValue[]> {
        this.checkUser("getWorkspaceEnvVars");
        const workspace = await this.internalGetWorkspace(workspaceId, this.workspaceDb.trace(ctx));
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

    // Get environment variables (filter by repository pattern precedence)
    // TODO remove then latsest gitpod-cli is deployed
    async getEnvVars(ctx: TraceContext): Promise<UserEnvVarValue[]> {
        const user = this.checkUser("getEnvVars");
        const result = new Map<string, { value: UserEnvVar; score: number }>();
        for (const value of await this.userDB.getEnvVars(user.id)) {
            if (!(await this.resourceAccessGuard.canAccess({ kind: "envVar", subject: value }, "get"))) {
                continue;
            }
            const score = UserEnvVar.score(value);
            const current = result.get(value.name);
            if (!current || score < current.score) {
                result.set(value.name, { value, score });
            }
        }
        return [...result.values()].map(({ value: { id, name, value, repositoryPattern } }) => ({
            id,
            name,
            value,
            repositoryPattern,
        }));
    }

    // Get all environment variables (unfiltered)
    async getAllEnvVars(ctx: TraceContext): Promise<UserEnvVarValue[]> {
        const user = this.checkUser("getAllEnvVars");
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
        const user = this.checkAndBlockUser("setEnvVar");
        const userId = user.id;

        // validate input
        const validationError = UserEnvVar.validate(variable);
        if (validationError) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, validationError);
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
                throw new ResponseError(
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
        const user = this.checkAndBlockUser("deleteEnvVar");
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
            throw new ResponseError(
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
        const user = this.checkUser("hasSSHPublicKey");
        return this.userDB.hasSSHPublicKey(user.id);
    }

    async getSSHPublicKeys(ctx: TraceContext): Promise<UserSSHPublicKeyValue[]> {
        const user = this.checkUser("getSSHPublicKeys");
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
        const user = this.checkUser("addSSHPublicKey");
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
        const user = this.checkUser("deleteSSHPublicKey");
        await this.userDB.deleteSSHPublicKey(user.id, id);
        this.updateSSHKeysForRegularRunningInstances(ctx, user.id).catch(console.error);
        return;
    }

    protected async updateSSHKeysForRegularRunningInstances(ctx: TraceContext, userId: string) {
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
        const user = this.checkAndBlockUser("setProjectEnvironmentVariable");
        await this.guardProjectOperation(user, projectId, "update");
        return this.projectsService.setProjectEnvironmentVariable(projectId, name, value, censored);
    }

    async getProjectEnvironmentVariables(ctx: TraceContext, projectId: string): Promise<ProjectEnvVar[]> {
        traceAPIParams(ctx, { projectId });
        const user = this.checkAndBlockUser("getProjectEnvironmentVariables");
        await this.guardProjectOperation(user, projectId, "get");
        return await this.projectsService.getProjectEnvironmentVariables(projectId);
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

    protected async internalGetProjectEnvVars(projectId?: string): Promise<ProjectEnvVar[]> {
        if (!projectId) {
            return [];
        }
        return await this.projectsService.getProjectEnvironmentVariables(projectId);
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

    protected async guardTeamOperation(
        teamId: string,
        op: ResourceAccessOp,
        fineGrainedOp: OrganizationOperation,
    ): Promise<{ team: Team; members: TeamMemberInfo[] }> {
        if (!uuidValidate(teamId)) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "organization ID must be a valid UUID");
        }

        const user = this.checkUser();
        const centralizedPermissionsEnabled = await getExperimentsClientForBackend().getValueAsync(
            "centralizedPermissions",
            false,
            {
                user: user,
                teamId: teamId,
            },
        );

        const checkAgainstDB = async (): Promise<{ team: Team; members: TeamMemberInfo[] }> => {
            // We deliberately wrap the entiry check in try-catch, because we're using Promise.all, which rejects if any of the promises reject.
            const team = await this.teamDB.findTeamById(teamId);
            if (!team) {
                // We return Permission Denied because we don't want to leak the existence, or not of the Organization.
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `No access to Organization ID: ${teamId}`);
            }

            const members = await this.teamDB.findMembersByTeam(team.id);
            await this.guardAccess({ kind: "team", subject: team, members }, op);

            return { team, members };
        };

        const checkWithCentralizedPerms = async (): Promise<CheckResult> => {
            if (centralizedPermissionsEnabled) {
                log.info("[perms] Checking team operations.", {
                    org: teamId,
                    operations: fineGrainedOp,
                    user: user.id,
                });

                return await this.guardOrganizationOperationWithCentralizedPerms(teamId, fineGrainedOp);
            }

            throw new Error("Centralized permissions feature not enabled.");
        };

        const [fromDB, fromCentralizedPerms] = await Promise.allSettled([
            // Permission checks against the DB will throw, if the user is not permitted to perform the action, or if iteraction with
            // dependencies (DB) fail.
            checkAgainstDB(),

            // Centralized perms checks only throw, when an interaction error occurs - connection not available or similar.
            // When the user is not permitted to perform the action, the call will resolve, encoding the result in the response.
            checkWithCentralizedPerms(),
        ]);

        // check against DB resolved, which means the user is permitted to perform the action
        if (fromDB.status === "fulfilled") {
            if (fromCentralizedPerms.status === "fulfilled") {
                // we got a result from centralized perms, but we still need to check if the outcome was such that the user is permitted
                reportCentralizedPermsValidation(fineGrainedOp, fromCentralizedPerms.value.permitted === true);
            } else {
                // centralized perms promise rejected, we do not have an agreement
                reportCentralizedPermsValidation(fineGrainedOp, false);
            }

            // Always return the result from the DB check
            return fromDB.value;
        } else {
            // The check agains the DB failed. This means the user does not have access.

            if (fromCentralizedPerms.status === "fulfilled") {
                // we got a result from centralized perms, but we still need to check if the outcome was such that the user is NOT permitted
                reportCentralizedPermsValidation(fineGrainedOp, fromCentralizedPerms.value.permitted === false);
            } else {
                // centralized perms promise rejected, we do not have an agreement
                reportCentralizedPermsValidation(fineGrainedOp, false);
            }

            // We re-throw the error from the DB permission check, to propagate it upstream.
            throw fromDB.reason;
        }
    }

    protected async guardOrganizationOperationWithCentralizedPerms(
        orgId: string,
        op: OrganizationOperation,
    ): Promise<CheckResult> {
        const user = this.checkUser();

        switch (op) {
            case "org_metadata_read":
                return await this.authorizer.check(ReadOrganizationMetadata(user.id, orgId));
            case "org_metadata_write":
                return await this.authorizer.check(WriteOrganizationMetadata(user.id, orgId));

            case "org_members_read":
                return await this.authorizer.check(ReadOrganizationMembers(user.id, orgId));
            case "org_members_write":
                return await this.authorizer.check(WriteOrganizationMembers(user.id, orgId));

            default:
                return NotPermitted;
        }
    }

    public async getTeams(ctx: TraceContext): Promise<Team[]> {
        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkUser("getTeams");
        return this.teamDB.findTeamsByUser(user.id);
    }

    public async getTeam(ctx: TraceContext, teamId: string): Promise<Team> {
        traceAPIParams(ctx, { teamId });

        this.checkAndBlockUser("getTeam");

        const { team } = await this.guardTeamOperation(teamId, "get", "org_members_read");
        return team;
    }

    public async updateTeam(ctx: TraceContext, teamId: string, team: Pick<Team, "name">): Promise<Team> {
        traceAPIParams(ctx, { teamId });
        this.checkUser("updateTeam");

        await this.guardTeamOperation(teamId, "update", "org_metadata_write");

        const updatedTeam = await this.teamDB.updateTeam(teamId, team);
        return updatedTeam;
    }

    public async getTeamMembers(ctx: TraceContext, teamId: string): Promise<TeamMemberInfo[]> {
        traceAPIParams(ctx, { teamId });

        this.checkUser("getTeamMembers");
        const { members } = await this.guardTeamOperation(teamId, "get", "org_members_read");

        return members;
    }

    public async createTeam(ctx: TraceContext, name: string): Promise<Team> {
        traceAPIParams(ctx, { name });

        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkAndBlockUser("createTeam");

        const mayCreateOrganization = await this.userService.mayCreateOrJoinOrganization(user);
        if (!mayCreateOrganization) {
            throw new ResponseError(
                ErrorCodes.PERMISSION_DENIED,
                "Organizational accounts are not allowed to create new organizations",
            );
        }

        const team = await this.teamDB.createTeam(user.id, name);
        const invite = await this.getGenericInvite(ctx, team.id);
        ctx.span?.setTag("teamId", team.id);
        this.analytics.track({
            userId: user.id,
            event: "team_created",
            properties: {
                id: team.id,
                name: team.name,
                created_at: team.creationTime,
                invite_id: invite.id,
            },
        });
        return team;
    }

    public async joinTeam(ctx: TraceContext, inviteId: string): Promise<Team> {
        traceAPIParams(ctx, { inviteId });

        const user = this.checkAndBlockUser("joinTeam");

        const mayCreateOrganization = await this.userService.mayCreateOrJoinOrganization(user);
        if (!mayCreateOrganization) {
            throw new ResponseError(
                ErrorCodes.PERMISSION_DENIED,
                "Organizational accounts are not allowed to join other organizations",
            );
        }

        // Invites can be used by anyone, as long as they know the invite ID, hence needs no resource guard
        const invite = await this.teamDB.findTeamMembershipInviteById(inviteId);
        if (!invite || invite.invalidationTime !== "") {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "The invite link is no longer valid.");
        }
        ctx.span?.setTag("teamId", invite.teamId);
        if (await this.teamDB.hasActiveSSO(invite.teamId)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }
        const result = await this.teamDB.addMemberToTeam(user.id, invite.teamId);
        const org = await this.getTeam(ctx, invite.teamId);
        if (org !== undefined) {
            try {
                // verify the new member if this org a paying customer
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
        if (result !== "already_member") {
            this.analytics.track({
                userId: user.id,
                event: "team_joined",
                properties: {
                    team_id: invite.teamId,
                    team_name: org?.name,
                    invite_id: inviteId,
                },
            });
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

        if (!uuidValidate(userId)) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "user ID must be a valid UUID");
        }

        if (!TeamMemberRole.isValid(role)) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "invalid role name");
        }

        this.checkAndBlockUser("setTeamMemberRole");
        await this.guardTeamOperation(teamId, "update", "org_members_write");

        await this.teamDB.setTeamMemberRole(userId, teamId, role);
    }

    public async removeTeamMember(ctx: TraceContext, teamId: string, userId: string): Promise<void> {
        traceAPIParams(ctx, { teamId, userId });

        if (!uuidValidate(userId)) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "user ID must be a valid UUID");
        }

        const currentUser = this.checkAndBlockUser("removeTeamMember");

        // The user is leaving a team, if they are removing themselves from the team.
        const currentUserLeavingTeam = currentUser.id === userId;
        if (!currentUserLeavingTeam) {
            await this.guardTeamOperation(teamId, "update", "not_implemented");
        } else {
            await this.guardTeamOperation(teamId, "get", "org_members_write");
        }

        // Check for existing membership.
        const membership = await this.teamDB.findTeamMembership(userId, teamId);
        if (!membership) {
            throw new Error(`Could not find membership for user '${userId}' in organization '${teamId}'`);
        }

        // Check if user's account belongs to the Org.
        const userToBeRemoved = currentUserLeavingTeam ? currentUser : await this.userDB.findUserById(userId);
        if (!userToBeRemoved) {
            throw new Error(`Could not find user '${userId}'`);
        }
        // Only invited members can be removed from the Org, but organizational accounts cannot.
        if (userToBeRemoved.organizationId && teamId === userToBeRemoved.organizationId) {
            throw new Error(`User's account '${userId}' belongs to the organization '${teamId}'`);
        }

        await this.teamDB.removeMemberFromTeam(userToBeRemoved.id, teamId);
        this.analytics.track({
            userId: currentUser.id,
            event: "team_user_removed",
            properties: {
                team_id: teamId,
                removed_user_id: userId,
            },
        });
    }

    public async getGenericInvite(ctx: TraceContext, teamId: string): Promise<TeamMembershipInvite> {
        traceAPIParams(ctx, { teamId });

        this.checkUser("getGenericInvite");
        await this.guardTeamOperation(teamId, "get", "org_members_write");

        if (await this.teamDB.hasActiveSSO(teamId)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }

        const invite = await this.teamDB.findGenericInviteByTeamId(teamId);
        if (invite) {
            return invite;
        }
        return this.teamDB.resetGenericInvite(teamId);
    }

    public async resetGenericInvite(ctx: TraceContext, teamId: string): Promise<TeamMembershipInvite> {
        traceAPIParams(ctx, { teamId });

        this.checkAndBlockUser("resetGenericInvite");
        await this.guardTeamOperation(teamId, "update", "org_members_write");
        if (await this.teamDB.hasActiveSSO(teamId)) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Invites are disabled for SSO-enabled organizations.");
        }
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
            await this.guardTeamOperation(project.teamId || "", "get", "not_implemented");
        }
    }

    public async deleteProject(ctx: TraceContext, projectId: string): Promise<void> {
        traceAPIParams(ctx, { projectId });

        const user = this.checkUser("deleteProject");
        await this.guardProjectOperation(user, projectId, "delete");
        this.analytics.track({
            userId: user.id,
            event: "project_deleted",
            properties: {
                project_id: projectId,
            },
        });
        return this.projectsService.deleteProject(projectId);
    }

    public async deleteTeam(ctx: TraceContext, teamId: string): Promise<void> {
        const user = this.checkAndBlockUser("deleteTeam");
        traceAPIParams(ctx, { teamId, userId: user.id });

        await this.guardTeamOperation(teamId, "delete", "org_write");

        const teamProjects = await this.projectsService.getTeamProjects(teamId);
        teamProjects.forEach((project) => {
            /** no await */ this.deleteProject(ctx, project.id).catch((err) => {
                /** ignore */
            });
        });

        const teamMembers = await this.teamDB.findMembersByTeam(teamId);
        teamMembers.forEach((member) => {
            /** no await */ this.removeTeamMember(ctx, teamId, member.userId).catch((err) => {
                /** ignore */
            });
        });

        // TODO: delete setting
        await this.teamDB.deleteTeam(teamId);

        return this.analytics.track({
            userId: user.id,
            event: "team_deleted",
            properties: {
                team_id: teamId,
            },
        });
    }

    async getOrgSettings(ctx: TraceContextWithSpan, orgId: string): Promise<OrganizationSettings> {
        const user = this.checkAndBlockUser("getOrgSettings");
        traceAPIParams(ctx, { orgId, userId: user.id });
        await this.guardTeamOperation(orgId, "get", "org_write");
        const settings = await this.teamDB.findOrgSettings(orgId);
        // TODO: make a default in protocol
        return settings ?? { workspaceSharingDisabled: false };
    }

    async updateOrgSettings(
        ctx: TraceContextWithSpan,
        orgId: string,
        settings: Partial<OrganizationSettings>,
    ): Promise<OrganizationSettings> {
        const user = this.checkAndBlockUser("updateOrgSettings");
        traceAPIParams(ctx, { orgId, userId: user.id });
        await this.guardTeamOperation(orgId, "update", "org_write");
        await this.teamDB.setOrgSettings(orgId, settings);
        return (await this.teamDB.findOrgSettings(orgId))!;
    }

    public async getTeamProjects(ctx: TraceContext, teamId: string): Promise<Project[]> {
        traceAPIParams(ctx, { teamId });

        this.checkUser("getTeamProjects");

        await this.guardTeamOperation(teamId, "get", "not_implemented");
        return this.projectsService.getTeamProjects(teamId);
    }

    public async getUserProjects(ctx: TraceContext): Promise<Project[]> {
        // Note: this operation is per-user only, hence needs no resource guard
        const user = this.checkAndBlockUser("getUserProjects");
        return this.projectsService.getUserProjects(user.id);
    }

    public async findPrebuilds(ctx: TraceContext, params: FindPrebuildsParams): Promise<PrebuildWithStatus[]> {
        traceAPIParams(ctx, { params });

        const user = this.checkAndBlockUser("findPrebuilds");
        await this.guardProjectOperation(user, params.projectId, "get");
        return this.projectsService.findPrebuilds(params);
    }

    public async getPrebuild(ctx: TraceContext, prebuildId: string): Promise<PrebuildWithStatus | undefined> {
        traceAPIParams(ctx, { prebuildId });
        this.checkAndBlockUser("getPrebuild");

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
        this.checkAndBlockUser("findPrebuildByWorkspaceID");

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

        const user = this.checkAndBlockUser("getProjectOverview");
        const project = await this.projectsService.getProject(projectId);
        if (!project) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Project not found");
        }
        await this.guardProjectOperation(user, projectId, "get");
        try {
            const result = await this.projectsService.getProjectOverviewCached(user, project);
            if (result) {
                result.isConsideredInactive = await this.projectsService.isProjectConsideredInactive(project.id);
            }
            return result;
        } catch (error) {
            if (UnauthorizedError.is(error)) {
                throw new ResponseError(ErrorCodes.NOT_AUTHENTICATED, "Unauthorized", error.data);
            }
            throw error;
        }
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
        traceAPIParams(ctx, { params });

        const user = this.checkUser("createProject");
        if (params.userId) {
            if (params.userId !== user.id) {
                throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `Cannot create Projects for other users`);
            }
        } else {
            // Anyone who can read a team's information (i.e. any team member) can create a new project.
            await this.guardTeamOperation(params.teamId || "", "get", "not_implemented");
        }

        const project = await this.projectsService.createProject(params, user);
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

    public async updateProjectPartial(ctx: TraceContext, partialProject: PartialProject): Promise<void> {
        traceAPIParams(ctx, {
            // censor everything irrelevant
            partialProject: {
                id: partialProject.id,
                settings: partialProject.settings,
            },
        });

        const user = this.checkUser("updateProjectPartial");
        await this.guardProjectOperation(user, partialProject.id, "update");

        const partial: PartialProject = { id: partialProject.id };
        const allowedFields: (keyof Project)[] = ["settings"];
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
        const res = (await this.userDB.findAllGitpodTokensOfUser(user.id)).filter((v) => !v.deleted);
        await Promise.all(res.map((tkn) => this.guardAccess({ kind: "gitpodToken", subject: tkn }, "get")));
        return res;
    }

    public async generateNewGitpodToken(
        ctx: TraceContext,
        options: { name?: string; type: GitpodTokenType; scopes?: string[] },
    ): Promise<string> {
        traceAPIParams(ctx, { options });

        const user = this.checkAndBlockUser("generateNewGitpodToken");
        const token = crypto.randomBytes(30).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
        const dbToken: DBGitpodToken = {
            tokenHash,
            name: options.name,
            type: options.type,
            user: user as DBUser,
            scopes: options.scopes || [],
            created: new Date().toISOString(),
        };
        await this.guardAccess({ kind: "gitpodToken", subject: dbToken }, "create");

        await this.userDB.storeGitpodToken(dbToken);
        return token;
    }

    public async getGitpodTokenScopes(ctx: TraceContext, tokenHash: string): Promise<string[]> {
        traceAPIParams(ctx, {}); // do not trace tokenHash

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
        traceAPIParams(ctx, {}); // do not trace tokenHash

        const user = this.checkAndBlockUser("deleteGitpodToken");
        const existingTokens = await this.getGitpodTokens(ctx); // all tokens for logged in user
        const tkn = existingTokens.find((token) => token.tokenHash === tokenHash);
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
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }

        if (!result) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }
        return this.censorUser(result);
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

    async adminDeleteUser(ctx: TraceContext, userId: string): Promise<void> {
        traceAPIParams(ctx, { userId });

        await this.guardAdminAccess("adminDeleteUser", { id: userId }, Permission.ADMIN_PERMISSIONS);

        try {
            await this.userDeletionService.deleteUser(userId);
        } catch (e) {
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, e.toString());
        }
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

    async adminModifyRoleOrPermission(ctx: TraceContext, req: AdminModifyRoleOrPermissionRequest): Promise<User> {
        traceAPIParams(ctx, { req });

        await this.guardAdminAccess("adminModifyRoleOrPermission", { req }, Permission.ADMIN_PERMISSIONS);

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

    async adminGetTeamMembers(ctx: TraceContext, teamId: string): Promise<TeamMemberInfo[]> {
        await this.guardAdminAccess("adminGetTeamMembers", { teamId }, Permission.ADMIN_WORKSPACES);

        const team = await this.teamDB.findTeamById(teamId);
        if (!team) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Team not found");
        }
        const members = await this.teamDB.findMembersByTeam(team.id);
        return members;
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

    async adminGetTelemetryData(ctx: TraceContext): Promise<TelemetryData> {
        traceAPIParams(ctx, {});

        await this.guardAdminAccess("adminGetTelemetryData", {}, Permission.ADMIN_API);

        return await this.telemetryDataProvider.getTelemetryData();
    }

    protected censorUser(user: User): User {
        const res = { ...user };
        delete res.additionalData;
        res.identities = res.identities.map((i) => {
            delete i.tokens;

            // The user field is not in the Identity shape, but actually exists on DBIdentity.
            // Trying to push this object out via JSON RPC will fail because of the cyclic nature
            // of this field.
            delete (i as any).user;
            return i;
        });
        return res;
    }

    async getOwnAuthProviders(ctx: TraceContext): Promise<AuthProviderEntry[]> {
        const redacted = (entry: AuthProviderEntry) => AuthProviderEntry.redact(entry);
        const userId = this.checkAndBlockUser("getOwnAuthProviders").id;
        const ownAuthProviders = await this.authProviderService.getAuthProvidersOfUser(userId);
        return ownAuthProviders.map(redacted);
    }

    async updateOwnAuthProvider(
        ctx: TraceContext,
        { entry }: GitpodServer.UpdateOwnAuthProviderParams,
    ): Promise<AuthProviderEntry> {
        traceAPIParams(ctx, {}); // entry contains PII

        const userId = this.checkAndBlockUser("updateOwnAuthProvider").id;
        if (userId !== entry.ownerId) {
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, "Not allowed to modify this resource.");
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
            throw new ResponseError(ErrorCodes.CONFLICT, message);
        }
    }
    protected redactUpdateOwnAuthProviderParams({ entry }: GitpodServer.UpdateOwnAuthProviderParams) {
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

        const userId = this.checkAndBlockUser("deleteOwnAuthProvider").id;
        const ownProviders = await this.authProviderService.getAuthProvidersOfUser(userId);
        const authProvider = ownProviders.find((p) => p.id === params.id);
        if (!authProvider) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "User resource not found.");
        }
        try {
            await this.authProviderService.deleteAuthProvider(authProvider);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to delete the provider.";
            throw new ResponseError(ErrorCodes.CONFLICT, message);
        }
    }

    async createOrgAuthProvider(
        ctx: TraceContext,
        { entry }: GitpodServer.CreateOrgAuthProviderParams,
    ): Promise<AuthProviderEntry> {
        traceAPIParams(ctx, {}); // entry contains PII

        let user = this.checkAndBlockUser("createOrgAuthProvider");

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
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Invalid organizationId");
        }

        await this.guardWithFeatureFlag("orgGitAuthProviders", newProvider.organizationId);

        if (!newProvider.host) {
            throw new ResponseError(
                ErrorCodes.BAD_REQUEST,
                "Must provider a host value when creating a new auth provider.",
            );
        }

        // Ensure user can perform this operation on this organization
        await this.guardTeamOperation(newProvider.organizationId, "update", "org_authprovider_write");

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
            throw new ResponseError(ErrorCodes.CONFLICT, message);
        }
    }

    async updateOrgAuthProvider(
        ctx: TraceContext,
        { entry }: GitpodServer.UpdateOrgAuthProviderParams,
    ): Promise<AuthProviderEntry> {
        traceAPIParams(ctx, {}); // entry contains PII

        this.checkAndBlockUser("updateOrgAuthProvider");

        // map params to a provider update
        const providerUpdate: AuthProviderEntry.UpdateOrgEntry = {
            id: entry.id,
            clientId: entry.clientId,
            clientSecret: entry.clientSecret,
            organizationId: entry.organizationId,
        };

        if (!providerUpdate.organizationId || !uuidValidate(providerUpdate.organizationId)) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Invalid organizationId");
        }

        await this.guardWithFeatureFlag("orgGitAuthProviders", providerUpdate.organizationId);

        await this.guardTeamOperation(providerUpdate.organizationId, "update", "org_authprovider_write");

        try {
            const result = await this.authProviderService.updateOrgAuthProvider(providerUpdate);
            return AuthProviderEntry.redact(result);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to update the provider.";
            throw new ResponseError(ErrorCodes.CONFLICT, message);
        }
    }

    async getOrgAuthProviders(
        ctx: TraceContext,
        params: GitpodServer.GetOrgAuthProviderParams,
    ): Promise<AuthProviderEntry[]> {
        traceAPIParams(ctx, { params });

        this.checkAndBlockUser("getOrgAuthProviders");

        await this.guardWithFeatureFlag("orgGitAuthProviders", params.organizationId);

        await this.guardTeamOperation(params.organizationId, "get", "org_authprovider_read");

        try {
            const result = await this.authProviderService.getAuthProvidersOfOrg(params.organizationId);
            return result.map(AuthProviderEntry.redact.bind(AuthProviderEntry));
        } catch (error) {
            const message =
                error && error.message ? error.message : "Error retreiving auth providers for organization.";
            throw new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, message);
        }
    }

    async deleteOrgAuthProvider(ctx: TraceContext, params: GitpodServer.DeleteOrgAuthProviderParams): Promise<void> {
        traceAPIParams(ctx, { params });

        this.checkAndBlockUser("deleteOrgAuthProvider");

        const team = await this.getTeam(ctx, params.organizationId);
        if (!team) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Invalid organizationId");
        }

        await this.guardWithFeatureFlag("orgGitAuthProviders", team.id);

        // Find the matching auth provider we're attempting to delete
        const orgProviders = await this.authProviderService.getAuthProvidersOfOrg(team.id);
        const authProvider = orgProviders.find((p) => p.id === params.id);
        if (!authProvider) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Provider resource not found.");
        }

        await this.guardTeamOperation(authProvider.organizationId || "", "delete", "org_authprovider_write");

        try {
            await this.authProviderService.deleteAuthProvider(authProvider);
        } catch (error) {
            const message = error && error.message ? error.message : "Failed to delete the provider.";
            throw new ResponseError(ErrorCodes.CONFLICT, message);
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

    protected async guardWithFeatureFlag(flagName: string, teamId: string) {
        // Guard method w/ a feature flag check
        const isEnabled = await this.configCatClientFactory().getValueAsync(flagName, false, {
            user: this.user,
            teamId,
        });
        if (!isEnabled) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Method not available");
        }
    }

    public async trackEvent(ctx: TraceContext, event: RemoteTrackMessage): Promise<void> {
        // Beware: DO NOT just event... the message, but consume it individually as the message is coming from
        //         the wire and we have no idea what's in it. Even passing the context and properties directly
        //         is questionable. Considering we're handing down the msg and do not know how the analytics library
        //         handles potentially broken or malicious input, we better err on the side of caution.

        const userId = this.user?.id;
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
        const userId = this.user?.id;
        const { ip, userAgent } = this.clientHeaderFields;
        const anonymousId = event.anonymousId || createCookielessId(ip, userAgent);
        let msg = {
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
        const user = this.checkUser("identifyUser");
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
        const user = this.checkUser("identifyUser");
        const email = User.getPrimaryEmail(user);
        const ideConfig = await this.ideService.getIDEConfig({ user: { id: user.id, email } });
        return ideConfig.ideOptions;
    }

    async getSupportedWorkspaceClasses(ctx: TraceContext): Promise<SupportedWorkspaceClass[]> {
        this.checkAndBlockUser("getSupportedWorkspaceClasses");
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
    async setUsageAttribution(ctx: TraceContext, usageAttributionId: string): Promise<void> {
        const user = this.checkAndBlockUser("setUsageAttribution");
        try {
            const attrId = AttributionId.parse(usageAttributionId);
            if (attrId) {
                await this.userService.setUsageAttribution(user, usageAttributionId);
            }
        } catch (error) {
            log.error({ userId: user.id }, "Cannot set usage attribution", error, { usageAttributionId });
            throw new ResponseError(ErrorCodes.PERMISSION_DENIED, `Cannot set usage attribution`);
        }
    }

    async listAvailableUsageAttributionIds(ctx: TraceContext): Promise<string[]> {
        const user = this.checkAndBlockUser("listAvailableUsageAttributionIds");

        const attributionIds = await this.userService.listAvailableUsageAttributionIds(user);
        return attributionIds.map(AttributionId.render);
    }

    async getLinkedInClientId(ctx: TraceContextWithSpan): Promise<string> {
        traceAPIParams(ctx, {});
        this.checkAndBlockUser("getLinkedInClientID");
        const clientId = this.config.linkedInSecrets?.clientId;
        if (!clientId) {
            throw new ResponseError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                "LinkedIn is not properly configured (no Client ID)",
            );
        }
        return clientId;
    }

    async connectWithLinkedIn(ctx: TraceContextWithSpan, code: string): Promise<LinkedInProfile> {
        traceAPIParams(ctx, { code });
        const user = this.checkAndBlockUser("connectWithLinkedIn");
        const profile = await this.linkedInService.connectWithLinkedIn(user, code);
        return profile;
    }

    //
    //#endregion

    /**
     * This method is temporary until we moved image-builder into workspace clusters
     * @param user
     * @param workspace
     * @param instance
     * @returns
     */
    protected async getImageBuilderClient(user: User, workspace: Workspace, instance?: WorkspaceInstance) {
        return this.imagebuilderClientProvider.getClient(user, workspace, instance);
    }

    async reportErrorBoundary(ctx: TraceContextWithSpan, url: string, message: string): Promise<void> {
        // Cap message and url length so the entries aren't of unbounded length
        log.warn("dashboard error boundary", {
            message: (message || "").substring(0, 200),
            url: (url || "").substring(0, 200),
            userId: this.user?.id,
        });
        increaseDashboardErrorBoundaryCounter();
    }

    protected mapGrpcError(err: Error): Error {
        function isGrpcError(err: any): err is grpc.StatusObject {
            return err.code && err.details;
        }

        if (!isGrpcError(err)) {
            return err;
        }

        switch (err.code) {
            case grpc.status.RESOURCE_EXHAUSTED:
                return new ResponseError(ErrorCodes.TOO_MANY_REQUESTS, err.details);
            default:
                return new ResponseError(ErrorCodes.INTERNAL_SERVER_ERROR, err.details);
        }
    }

    private async determineWorkspaceRegion(ws: Workspace, preference: WorkspaceRegion): Promise<WorkspaceRegion> {
        const guessWorkspaceRegionEnabled = await getExperimentsClientForBackend().getValueAsync(
            "guessWorkspaceRegion",
            false,
            {
                user: this.user,
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

        const logCtx = { userId: this.user?.id, workspaceId: ws.id };
        log.info(logCtx, "[guessWorkspaceRegion] Workspace with region selection", regionLogContext);

        return targetRegion;
    }

    async getIDToken(): Promise<void> {}

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

            // marking all members as verified
            if (attrId.kind === "team") {
                try {
                    await this.verificationService.verifyOrgMembers(attrId.teamId);
                } catch (err) {
                    log.error(`Failed to verify org members`, err, { organizationId: attrId.teamId });
                }
            }

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
            throw new ResponseError(ErrorCodes.NOT_FOUND, `Couldn't find cost center with id ${attributionId}`);
        }
        const stripeSubscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(attributionId);
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

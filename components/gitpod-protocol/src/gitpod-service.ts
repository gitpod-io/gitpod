/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    User,
    WorkspaceInfo,
    WorkspaceCreationResult,
    WorkspaceInstanceUser,
    WorkspaceImageBuild,
    AuthProviderInfo,
    Token,
    UserEnvVarValue,
    Configuration,
    UserInfo,
    GitpodTokenType,
    GitpodToken,
    AuthProviderEntry,
    GuessGitTokenScopesParams,
    GuessedGitTokenScopes,
    ProjectEnvVar,
    PrebuiltWorkspace,
    UserSSHPublicKeyValue,
    SSHPublicKeyValue,
    IDESettings,
    EnvVarWithValue,
    WorkspaceTimeoutSetting,
    WorkspaceContext,
    LinkedInProfile,
    SuggestedRepository,
} from "./protocol";
import {
    Team,
    TeamMemberInfo,
    TeamMembershipInvite,
    Project,
    TeamMemberRole,
    PrebuildWithStatus,
    StartPrebuildResult,
    PartialProject,
    OrganizationSettings,
} from "./teams-projects-protocol";
import { JsonRpcProxy, JsonRpcServer } from "./messaging/proxy-factory";
import { Disposable, CancellationTokenSource, CancellationToken } from "vscode-jsonrpc";
import { HeadlessLogUrls } from "./headless-workspace-log";
import {
    WorkspaceInstance,
    WorkspaceInstancePort,
    WorkspaceInstancePhase,
    WorkspaceInstanceRepoStatus,
} from "./workspace-instance";
import { AdminServer } from "./admin-protocol";
import { Emitter } from "./util/event";
import { RemotePageMessage, RemoteTrackMessage, RemoteIdentifyMessage } from "./analytics";
import { IDEServer } from "./ide-protocol";
import { ListUsageRequest, ListUsageResponse, CostCenterJSON } from "./usage";
import { SupportedWorkspaceClass } from "./workspace-class";
import { BillingMode } from "./billing-mode";
import { WorkspaceRegion } from "./workspace-cluster";

export interface GitpodClient {
    onInstanceUpdate(instance: WorkspaceInstance): void;
    onWorkspaceImageBuildLogs: WorkspaceImageBuild.LogCallback;

    onPrebuildUpdate(update: PrebuildWithStatus): void;

    //#region propagating reconnection to iframe
    notifyDidOpenConnection(): void;
    notifyDidCloseConnection(): void;
    //#endregion
}

export const GitpodServer = Symbol("GitpodServer");
export interface GitpodServer extends JsonRpcServer<GitpodClient>, AdminServer, IDEServer {
    // User related API
    getLoggedInUser(): Promise<User>;
    updateLoggedInUser(user: Partial<User>): Promise<User>;
    sendPhoneNumberVerificationToken(phoneNumber: string): Promise<{ verificationId: string }>;
    verifyPhoneNumberVerificationToken(phoneNumber: string, token: string, verificationId: string): Promise<boolean>;
    getConfiguration(): Promise<Configuration>;
    getToken(query: GitpodServer.GetTokenSearchOptions): Promise<Token | undefined>;
    getGitpodTokenScopes(tokenHash: string): Promise<string[]>;
    deleteAccount(): Promise<void>;
    getClientRegion(): Promise<string | undefined>;

    // Auth Provider API
    getAuthProviders(): Promise<AuthProviderInfo[]>;
    // user-level
    getOwnAuthProviders(): Promise<AuthProviderEntry[]>;
    updateOwnAuthProvider(params: GitpodServer.UpdateOwnAuthProviderParams): Promise<AuthProviderEntry>;
    deleteOwnAuthProvider(params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void>;
    // org-level
    createOrgAuthProvider(params: GitpodServer.CreateOrgAuthProviderParams): Promise<AuthProviderEntry>;
    updateOrgAuthProvider(params: GitpodServer.UpdateOrgAuthProviderParams): Promise<AuthProviderEntry>;
    getOrgAuthProviders(params: GitpodServer.GetOrgAuthProviderParams): Promise<AuthProviderEntry[]>;
    deleteOrgAuthProvider(params: GitpodServer.DeleteOrgAuthProviderParams): Promise<void>;
    // public-api compatibility
    /** @deprecated used for public-api compatibility only */
    getAuthProvider(id: string): Promise<AuthProviderEntry>;
    /** @deprecated used for public-api compatibility only */
    deleteAuthProvider(id: string): Promise<void>;
    /** @deprecated used for public-api compatibility only */
    updateAuthProvider(id: string, update: AuthProviderEntry.UpdateOAuth2Config): Promise<AuthProviderEntry>;

    // Query/retrieve workspaces
    getWorkspaces(options: GitpodServer.GetWorkspacesOptions): Promise<WorkspaceInfo[]>;
    getWorkspaceOwner(workspaceId: string): Promise<UserInfo | undefined>;
    getWorkspaceUsers(workspaceId: string): Promise<WorkspaceInstanceUser[]>;
    getSuggestedRepositories(organizationId: string): Promise<SuggestedRepository[]>;
    searchRepositories(params: SearchRepositoriesParams): Promise<SuggestedRepository[]>;
    /**
     * **Security:**
     * Sensitive information like an owner token is erased, since it allows access for all team members.
     * If you need to access an owner token use `getOwnerToken` instead.
     */
    getWorkspace(id: string): Promise<WorkspaceInfo>;
    isWorkspaceOwner(workspaceId: string): Promise<boolean>;
    getOwnerToken(workspaceId: string): Promise<string>;
    getIDECredentials(workspaceId: string): Promise<string>;

    /**
     * Creates and starts a workspace for the given context URL.
     * @param options GitpodServer.CreateWorkspaceOptions
     * @return WorkspaceCreationResult
     */
    createWorkspace(options: GitpodServer.CreateWorkspaceOptions): Promise<WorkspaceCreationResult>;
    startWorkspace(id: string, options: GitpodServer.StartWorkspaceOptions): Promise<StartWorkspaceResult>;
    stopWorkspace(id: string): Promise<void>;
    deleteWorkspace(id: string): Promise<void>;
    setWorkspaceDescription(id: string, desc: string): Promise<void>;
    controlAdmission(id: string, level: GitpodServer.AdmissionLevel): Promise<void>;
    resolveContext(contextUrl: string): Promise<WorkspaceContext>;

    updateWorkspaceUserPin(id: string, action: GitpodServer.PinAction): Promise<void>;
    sendHeartBeat(options: GitpodServer.SendHeartBeatOptions): Promise<void>;
    watchWorkspaceImageBuildLogs(workspaceId: string): Promise<void>;
    isPrebuildDone(pwsid: string): Promise<boolean>;
    getHeadlessLog(instanceId: string): Promise<HeadlessLogUrls>;

    // Workspace timeout
    setWorkspaceTimeout(workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult>;
    getWorkspaceTimeout(workspaceId: string): Promise<GetWorkspaceTimeoutResult>;

    // Port management
    getOpenPorts(workspaceId: string): Promise<WorkspaceInstancePort[]>;
    openPort(workspaceId: string, port: WorkspaceInstancePort): Promise<WorkspaceInstancePort | undefined>;
    closePort(workspaceId: string, port: number): Promise<void>;

    updateGitStatus(workspaceId: string, status: Required<WorkspaceInstanceRepoStatus> | undefined): Promise<void>;

    // Workspace env vars
    getWorkspaceEnvVars(workspaceId: string): Promise<EnvVarWithValue[]>;

    // User env vars
    getAllEnvVars(): Promise<UserEnvVarValue[]>;
    setEnvVar(variable: UserEnvVarValue): Promise<void>;
    deleteEnvVar(variable: UserEnvVarValue): Promise<void>;

    // User SSH Keys
    hasSSHPublicKey(): Promise<boolean>;
    getSSHPublicKeys(): Promise<UserSSHPublicKeyValue[]>;
    addSSHPublicKey(value: SSHPublicKeyValue): Promise<UserSSHPublicKeyValue>;
    deleteSSHPublicKey(id: string): Promise<void>;

    // Teams
    getTeam(teamId: string): Promise<Team>;
    updateTeam(teamId: string, team: Pick<Team, "name">): Promise<Team>;
    getTeams(): Promise<Team[]>;
    getTeamMembers(teamId: string): Promise<TeamMemberInfo[]>;
    createTeam(name: string): Promise<Team>;
    joinTeam(inviteId: string): Promise<Team>;
    setTeamMemberRole(teamId: string, userId: string, role: TeamMemberRole): Promise<void>;
    removeTeamMember(teamId: string, userId: string): Promise<void>;
    getGenericInvite(teamId: string): Promise<TeamMembershipInvite>;
    resetGenericInvite(inviteId: string): Promise<TeamMembershipInvite>;
    deleteTeam(teamId: string): Promise<void>;
    getOrgSettings(orgId: string): Promise<OrganizationSettings>;
    updateOrgSettings(teamId: string, settings: Partial<OrganizationSettings>): Promise<OrganizationSettings>;
    getOrgWorkspaceClasses(orgId: string): Promise<SupportedWorkspaceClass[]>;

    getDefaultWorkspaceImage(params: GetDefaultWorkspaceImageParams): Promise<GetDefaultWorkspaceImageResult>;

    // Dedicated, Dedicated, Dedicated
    getOnboardingState(): Promise<GitpodServer.OnboardingState>;

    // Projects
    /** @deprecated no-op */
    getProviderRepositoriesForUser(
        params: GetProviderRepositoriesParams,
        cancellationToken?: CancellationToken,
    ): Promise<ProviderRepository[]>;
    createProject(params: CreateProjectParams): Promise<Project>;
    deleteProject(projectId: string): Promise<void>;
    getTeamProjects(teamId: string): Promise<Project[]>;
    getProjectOverview(projectId: string): Promise<Project.Overview | undefined>;
    findPrebuilds(params: FindPrebuildsParams): Promise<PrebuildWithStatus[]>;
    findPrebuildByWorkspaceID(workspaceId: string): Promise<PrebuiltWorkspace | undefined>;
    getPrebuild(prebuildId: string): Promise<PrebuildWithStatus | undefined>;
    triggerPrebuild(projectId: string, branchName: string | null): Promise<StartPrebuildResult>;
    cancelPrebuild(projectId: string, prebuildId: string): Promise<void>;
    updateProjectPartial(partialProject: PartialProject): Promise<void>;
    setProjectEnvironmentVariable(
        projectId: string,
        name: string,
        value: string,
        censored: boolean,
        id?: string,
    ): Promise<void>;
    getProjectEnvironmentVariables(projectId: string): Promise<ProjectEnvVar[]>;
    deleteProjectEnvironmentVariable(variableId: string): Promise<void>;

    // Gitpod token
    getGitpodTokens(): Promise<GitpodToken[]>;
    generateNewGitpodToken(options: GitpodServer.GenerateNewGitpodTokenOptions): Promise<string>;
    deleteGitpodToken(tokenHash: string): Promise<void>;

    // misc
    /** @deprecated always returns false */
    isGitHubAppEnabled(): Promise<boolean>;
    /** @deprecated this is a no-op */
    registerGithubApp(installationId: string): Promise<void>;

    /**
     * Stores a new snapshot for the given workspace and bucketId. Returns _before_ the actual snapshot is done. To wait for that, use `waitForSnapshot`.
     * @return the snapshot id
     */
    takeSnapshot(options: GitpodServer.TakeSnapshotOptions): Promise<string>;
    /**
     *
     * @param snapshotId
     */
    waitForSnapshot(snapshotId: string): Promise<void>;

    /**
     * Returns the list of snapshots that exist for a workspace.
     */
    getSnapshots(workspaceID: string): Promise<string[]>;

    guessGitTokenScopes(params: GuessGitTokenScopesParams): Promise<GuessedGitTokenScopes>;

    /**
     * Stripe/Usage
     */
    getStripePublishableKey(): Promise<string>;
    findStripeSubscriptionId(attributionId: string): Promise<string | undefined>;
    getPriceInformation(attributionId: string): Promise<string | undefined>;
    createStripeCustomerIfNeeded(attributionId: string, currency: string): Promise<void>;
    createHoldPaymentIntent(
        attributionId: string,
    ): Promise<{ paymentIntentId: string; paymentIntentClientSecret: string }>;
    subscribeToStripe(attributionId: string, paymentIntentId: string, usageLimit: number): Promise<number | undefined>;
    getStripePortalUrl(attributionId: string): Promise<string>;
    getCostCenter(attributionId: string): Promise<CostCenterJSON | undefined>;
    setUsageLimit(attributionId: string, usageLimit: number): Promise<void>;
    getUsageBalance(attributionId: string): Promise<number>;
    isCustomerBillingAddressInvalid(attributionId: string): Promise<boolean>;

    listUsage(req: ListUsageRequest): Promise<ListUsageResponse>;

    getBillingModeForTeam(teamId: string): Promise<BillingMode>;

    getLinkedInClientId(): Promise<string>;
    connectWithLinkedIn(code: string): Promise<LinkedInProfile>;

    /**
     * Analytics
     */
    trackEvent(event: RemoteTrackMessage): Promise<void>;
    trackLocation(event: RemotePageMessage): Promise<void>;
    identifyUser(event: RemoteIdentifyMessage): Promise<void>;

    /**
     * Frontend metrics
     */
    reportErrorBoundary(url: string, message: string): Promise<void>;

    getSupportedWorkspaceClasses(): Promise<SupportedWorkspaceClass[]>;
    updateWorkspaceTimeoutSetting(setting: Partial<WorkspaceTimeoutSetting>): Promise<void>;

    /**
     * getIDToken - doesn't actually do anything, just used to authenticat/authorise
     */
    getIDToken(): Promise<void>;
}

export interface RateLimiterError {
    method?: string;

    /**
     * Retry after this many seconds, earliest.
     * cmp.: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
     */
    retryAfter: number;
}

export interface GetDefaultWorkspaceImageParams {
    // filter with workspaceId (actually we will find with organizationId, and it's a real time finding)
    workspaceId?: string;
}

export type DefaultImageSource =
    | "installation" // Source installation means the image comes from Gitpod instance install config
    | "organization"; // Source organization means the image comes from Organization settings

export interface GetDefaultWorkspaceImageResult {
    image: string;
    source: DefaultImageSource;
}

export interface CreateProjectParams {
    name: string;
    cloneUrl: string;
    teamId: string;
    appInstallationId: string;
}
export interface FindPrebuildsParams {
    projectId: string;
    branch?: string;
    latest?: boolean;
    prebuildId?: string;
    // default: 30
    limit?: number;
}
export interface GetProviderRepositoriesParams {
    provider: string;
    hints?: { installationId: string } | object;
    searchString?: string;
    limit?: number;
    maxPages?: number;
}
export interface SearchRepositoriesParams {
    /** @deprecated unused */
    organizationId?: string;
    searchString: string;
    limit?: number; // defaults to 30
}
export interface ProviderRepository {
    name: string;
    path?: string;
    account: string;
    accountAvatarUrl: string;
    cloneUrl: string;
    updatedAt?: string;
    installationId?: number;
    installationUpdatedAt?: string;
}

const WORKSPACE_MAXIMUM_TIMEOUT_HOURS = 24;

export type WorkspaceTimeoutDuration = string;
export namespace WorkspaceTimeoutDuration {
    export function validate(duration: string): WorkspaceTimeoutDuration {
        duration = duration.toLowerCase();
        const unit = duration.slice(-1);
        if (!["m", "h"].includes(unit)) {
            throw new Error(`Invalid timeout unit: ${unit}`);
        }
        const value = parseInt(duration.slice(0, -1), 10);
        if (isNaN(value) || value <= 0) {
            throw new Error(`Invalid timeout value: ${duration}`);
        }
        if (
            (unit === "h" && value > WORKSPACE_MAXIMUM_TIMEOUT_HOURS) ||
            (unit === "m" && value > WORKSPACE_MAXIMUM_TIMEOUT_HOURS * 60)
        ) {
            throw new Error("Workspace inactivity timeout cannot exceed 24h");
        }
        return value + unit;
    }
}

export const WORKSPACE_TIMEOUT_DEFAULT_SHORT: WorkspaceTimeoutDuration = "30m";
export const WORKSPACE_TIMEOUT_DEFAULT_LONG: WorkspaceTimeoutDuration = "60m";
export const WORKSPACE_TIMEOUT_EXTENDED: WorkspaceTimeoutDuration = "180m";
export const WORKSPACE_LIFETIME_SHORT: WorkspaceTimeoutDuration = "8h";
export const WORKSPACE_LIFETIME_LONG: WorkspaceTimeoutDuration = "36h";

export const createServiceMock = function <C extends GitpodClient, S extends GitpodServer>(
    methods: Partial<JsonRpcProxy<S>>,
): GitpodServiceImpl<C, S> {
    return new GitpodServiceImpl<C, S>(createServerMock(methods));
};

export const createServerMock = function <S extends GitpodServer>(methods: Partial<JsonRpcProxy<S>>): JsonRpcProxy<S> {
    methods.setClient = methods.setClient || (() => {});
    methods.dispose = methods.dispose || (() => {});
    return new Proxy<JsonRpcProxy<S>>(methods as any as JsonRpcProxy<S>, {
        // @ts-ignore
        get: (target: S, property: keyof S) => {
            const result = target[property];
            if (!result) {
                throw new Error(`Method ${String(property)} not implemented`);
            }
            return result;
        },
    });
};

export interface SetWorkspaceTimeoutResult {
    resetTimeoutOnWorkspaces: string[];
    humanReadableDuration: string;
}

export interface GetWorkspaceTimeoutResult {
    duration: WorkspaceTimeoutDuration;
    canChange: boolean;
    humanReadableDuration: string;
}

export interface StartWorkspaceResult {
    instanceID: string;
    workspaceURL?: string;
}

export namespace GitpodServer {
    export interface GetWorkspacesOptions {
        limit?: number;
        searchString?: string;
        pinnedOnly?: boolean;
        projectId?: string | string[];
        includeWithoutProject?: boolean;
        organizationId?: string;
    }
    export interface GetAccountStatementOptions {
        date?: string;
    }
    export interface CreateWorkspaceOptions extends StartWorkspaceOptions {
        contextUrl: string;
        organizationId: string;
        projectId?: string;

        // whether running workspaces on the same context should be ignored. If false (default) users will be asked.
        //TODO(se) remove this option and let clients do that check if they like. The new create workspace page does it already
        ignoreRunningWorkspaceOnSameCommit?: boolean;
        forceDefaultConfig?: boolean;
    }

    export interface StartWorkspaceOptions {
        //TODO(cw): none of these options can be changed for a workspace that's been created. Should be moved to CreateWorkspaceOptions.
        forceDefaultImage?: boolean;
        workspaceClass?: string;
        ideSettings?: IDESettings;
        region?: WorkspaceRegion;
    }
    export interface TakeSnapshotOptions {
        workspaceId: string;
        /* this is here to enable backwards-compatibility and untangling rollout between workspace, IDE and meta */
        dontWait?: boolean;
    }
    export interface GetTokenSearchOptions {
        readonly host: string;
    }
    export interface SendHeartBeatOptions {
        readonly instanceId: string;
        readonly wasClosed?: boolean;
        readonly roundTripTime?: number;
    }
    export interface UpdateOwnAuthProviderParams {
        readonly entry: AuthProviderEntry.UpdateEntry | AuthProviderEntry.NewEntry;
    }
    export interface DeleteOwnAuthProviderParams {
        readonly id: string;
    }
    export interface CreateOrgAuthProviderParams {
        // ownerId is automatically set to the authenticated user
        readonly entry: Omit<AuthProviderEntry.NewOrgEntry, "ownerId">;
    }
    export interface UpdateOrgAuthProviderParams {
        readonly entry: AuthProviderEntry.UpdateOrgEntry;
    }
    export interface GetOrgAuthProviderParams {
        readonly organizationId: string;
    }
    export interface DeleteOrgAuthProviderParams {
        readonly id: string;
        readonly organizationId: string;
    }
    export type AdmissionLevel = "owner" | "everyone";
    export type PinAction = "pin" | "unpin" | "toggle";
    export interface GenerateNewGitpodTokenOptions {
        name?: string;
        type: GitpodTokenType;
        scopes?: string[];
    }
    export interface OnboardingState {
        /**
         * Whether this Gitpod instance is already configured with SSO.
         */
        readonly isCompleted: boolean;

        /**
         * Whether this Gitpod instance has at least one org.
         */
        readonly hasAnyOrg: boolean;
    }
}

export const GitpodServerPath = "/gitpod";

export const GitpodServerProxy = Symbol("GitpodServerProxy");
export type GitpodServerProxy<S extends GitpodServer> = JsonRpcProxy<S>;

export class GitpodCompositeClient<Client extends GitpodClient> implements GitpodClient {
    protected clients: Partial<Client>[] = [];

    public registerClient(client: Partial<Client>): Disposable {
        this.clients.push(client);
        return {
            dispose: () => {
                const index = this.clients.indexOf(client);
                if (index > -1) {
                    this.clients.splice(index, 1);
                }
            },
        };
    }

    onInstanceUpdate(instance: WorkspaceInstance): void {
        for (const client of this.clients) {
            if (client.onInstanceUpdate) {
                try {
                    client.onInstanceUpdate(instance);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    onPrebuildUpdate(update: PrebuildWithStatus): void {
        for (const client of this.clients) {
            if (client.onPrebuildUpdate) {
                try {
                    client.onPrebuildUpdate(update);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    onWorkspaceImageBuildLogs(
        info: WorkspaceImageBuild.StateInfo,
        content: WorkspaceImageBuild.LogContent | undefined,
    ): void {
        for (const client of this.clients) {
            if (client.onWorkspaceImageBuildLogs) {
                try {
                    client.onWorkspaceImageBuildLogs(info, content);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    notifyDidOpenConnection(): void {
        for (const client of this.clients) {
            if (client.notifyDidOpenConnection) {
                try {
                    client.notifyDidOpenConnection();
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    notifyDidCloseConnection(): void {
        for (const client of this.clients) {
            if (client.notifyDidCloseConnection) {
                try {
                    client.notifyDidCloseConnection();
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }
}

export type GitpodService = GitpodServiceImpl<GitpodClient, GitpodServer>;

const hasWindow = typeof window !== "undefined";
const phasesOrder: Record<WorkspaceInstancePhase, number> = {
    unknown: 0,
    preparing: 1,
    building: 2,
    pending: 3,
    creating: 4,
    initializing: 5,
    running: 6,
    interrupted: 7,
    stopping: 8,
    stopped: 9,
};
export class WorkspaceInstanceUpdateListener {
    private readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    private source: "sync" | "update" = "sync";

    get info(): WorkspaceInfo {
        return this._info;
    }

    constructor(private readonly service: GitpodService, private _info: WorkspaceInfo) {
        service.registerClient({
            onInstanceUpdate: (instance) => {
                if (this.isOutOfOrder(instance)) {
                    return;
                }
                this.cancelSync();
                this._info.latestInstance = instance;
                this.source = "update";
                this.onDidChangeEmitter.fire(undefined);
            },
            notifyDidOpenConnection: () => {
                this.sync();
            },
        });
        if (hasWindow) {
            // learn about page lifecycle here: https://developers.google.com/web/updates/2018/07/page-lifecycle-api
            window.document.addEventListener("visibilitychange", async () => {
                if (window.document.visibilityState === "visible") {
                    this.sync();
                }
            });
            window.addEventListener("pageshow", (e) => {
                if (e.persisted) {
                    this.sync();
                }
            });
        }
    }

    private syncQueue = Promise.resolve();
    private syncTokenSource: CancellationTokenSource | undefined;
    /**
     * Only one sync can be performed at the same time.
     * Any new sync request or instance update cancels all previously scheduled sync requests.
     */
    private sync(): void {
        this.cancelSync();
        this.syncTokenSource = new CancellationTokenSource();
        const token = this.syncTokenSource.token;
        this.syncQueue = this.syncQueue.then(async () => {
            if (token.isCancellationRequested) {
                return;
            }
            try {
                const info = await this.service.server.getWorkspace(this._info.workspace.id);
                if (token.isCancellationRequested) {
                    return;
                }
                this._info = info;
                this.source = "sync";
                this.onDidChangeEmitter.fire(undefined);
            } catch (e) {
                console.error("failed to sync workspace instance:", e);
            }
        });
    }
    private cancelSync(): void {
        if (this.syncTokenSource) {
            this.syncTokenSource.cancel();
            this.syncTokenSource = undefined;
        }
    }

    /**
     * If sync seen more recent update then ignore all updates with previous phases.
     * Within the same phase still the race can occur but which should be eventually consistent.
     */
    private isOutOfOrder(instance: WorkspaceInstance): boolean {
        if (instance.workspaceId !== this._info.workspace.id) {
            return true;
        }
        if (this.source === "update") {
            return false;
        }
        if (instance.id !== this.info.latestInstance?.id) {
            return false;
        }
        return phasesOrder[instance.status.phase] < phasesOrder[this.info.latestInstance.status.phase];
    }
}

export interface GitpodServiceOptions {
    onReconnect?: () => void | Promise<void>;
}

export class GitpodServiceImpl<Client extends GitpodClient, Server extends GitpodServer> {
    private readonly compositeClient = new GitpodCompositeClient<Client>();

    constructor(public readonly server: JsonRpcProxy<Server>, private options?: GitpodServiceOptions) {
        server.setClient(this.compositeClient);
        server.onDidOpenConnection(() => this.compositeClient.notifyDidOpenConnection());
        server.onDidCloseConnection(() => this.compositeClient.notifyDidCloseConnection());
    }

    public registerClient(client: Partial<Client>): Disposable {
        return this.compositeClient.registerClient(client);
    }

    private readonly instanceListeners = new Map<string, Promise<WorkspaceInstanceUpdateListener>>();
    listenToInstance(workspaceId: string): Promise<WorkspaceInstanceUpdateListener> {
        const listener =
            this.instanceListeners.get(workspaceId) ||
            (async () => {
                const info = await this.server.getWorkspace(workspaceId);
                return new WorkspaceInstanceUpdateListener(this, info);
            })();
        this.instanceListeners.set(workspaceId, listener);
        return listener;
    }

    async reconnect(): Promise<void> {
        if (this.options?.onReconnect) {
            await this.options.onReconnect();
        }
    }
}

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
    WhitelistedRepository,
    WorkspaceImageBuild,
    AuthProviderInfo,
    Token,
    UserEnvVarValue,
    Terms,
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
    PrebuildEvent,
} from "./teams-projects-protocol";
import { JsonRpcProxy, JsonRpcServer } from "./messaging/proxy-factory";
import { Disposable, CancellationTokenSource } from "vscode-jsonrpc";
import { HeadlessLogUrls } from "./headless-workspace-log";
import { WorkspaceInstance, WorkspaceInstancePort, WorkspaceInstancePhase } from "./workspace-instance";
import { AdminServer } from "./admin-protocol";
import { GitpodHostUrl } from "./util/gitpod-host-url";
import { WebSocketConnectionProvider } from "./messaging/browser/connection";
import { PermissionName } from "./permission";
import { LicenseService } from "./license-protocol";
import { Emitter } from "./util/event";
import { AccountStatement, CreditAlert } from "./accounting-protocol";
import { GithubUpgradeURL, PlanCoupon } from "./payment-protocol";
import {
    TeamSubscription,
    TeamSubscription2,
    TeamSubscriptionSlot,
    TeamSubscriptionSlotResolved,
} from "./team-subscription-protocol";
import { RemotePageMessage, RemoteTrackMessage, RemoteIdentifyMessage } from "./analytics";
import { IDEServer } from "./ide-protocol";
import { ListUsageRequest, ListUsageResponse, CostCenterJSON } from "./usage";
import { SupportedWorkspaceClass } from "./workspace-class";
import { BillingMode } from "./billing-mode";

export interface GitpodClient {
    onInstanceUpdate(instance: WorkspaceInstance): void;
    onWorkspaceImageBuildLogs: WorkspaceImageBuild.LogCallback;

    onPrebuildUpdate(update: PrebuildWithStatus): void;

    onNotificationUpdated(): void;

    onCreditAlert(creditAlert: CreditAlert): void;

    //#region propagating reconnection to iframe
    notifyDidOpenConnection(): void;
    notifyDidCloseConnection(): void;
    //#endregion
}

export const GitpodServer = Symbol("GitpodServer");
export interface GitpodServer extends JsonRpcServer<GitpodClient>, AdminServer, LicenseService, IDEServer {
    // User related API
    getLoggedInUser(): Promise<User>;
    getTerms(): Promise<Terms>;
    updateLoggedInUser(user: Partial<User>): Promise<User>;
    sendPhoneNumberVerificationToken(phoneNumber: string): Promise<void>;
    verifyPhoneNumberVerificationToken(phoneNumber: string, token: string): Promise<boolean>;
    getAuthProviders(): Promise<AuthProviderInfo[]>;
    getOwnAuthProviders(): Promise<AuthProviderEntry[]>;
    updateOwnAuthProvider(params: GitpodServer.UpdateOwnAuthProviderParams): Promise<AuthProviderEntry>;
    deleteOwnAuthProvider(params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void>;
    getConfiguration(): Promise<Configuration>;
    getToken(query: GitpodServer.GetTokenSearchOptions): Promise<Token | undefined>;
    getGitpodTokenScopes(tokenHash: string): Promise<string[]>;
    /**
     * @deprecated
     */
    getPortAuthenticationToken(workspaceId: string): Promise<Token>;
    deleteAccount(): Promise<void>;
    getClientRegion(): Promise<string | undefined>;
    hasPermission(permission: PermissionName): Promise<boolean>;

    // Query/retrieve workspaces
    getWorkspaces(options: GitpodServer.GetWorkspacesOptions): Promise<WorkspaceInfo[]>;
    getWorkspaceOwner(workspaceId: string): Promise<UserInfo | undefined>;
    getWorkspaceUsers(workspaceId: string): Promise<WorkspaceInstanceUser[]>;
    getFeaturedRepositories(): Promise<WhitelistedRepository[]>;
    getSuggestedContextURLs(): Promise<string[]>;
    /**
     * **Security:**
     * Sensitive information like an owner token is erased, since it allows access for all team members.
     * If you need to access an owner token use `getOwnerToken` instead.
     */
    getWorkspace(id: string): Promise<WorkspaceInfo>;
    isWorkspaceOwner(workspaceId: string): Promise<boolean>;
    getOwnerToken(workspaceId: string): Promise<string>;

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

    updateWorkspaceUserPin(id: string, action: GitpodServer.PinAction): Promise<void>;
    sendHeartBeat(options: GitpodServer.SendHeartBeatOptions): Promise<void>;
    watchWorkspaceImageBuildLogs(workspaceId: string): Promise<void>;
    isPrebuildDone(pwsid: string): Promise<boolean>;
    getHeadlessLog(instanceId: string): Promise<HeadlessLogUrls>;

    // Workspace timeout
    setWorkspaceTimeout(workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult>;
    getWorkspaceTimeout(workspaceId: string): Promise<GetWorkspaceTimeoutResult>;
    sendHeartBeat(options: GitpodServer.SendHeartBeatOptions): Promise<void>;

    updateWorkspaceUserPin(id: string, action: GitpodServer.PinAction): Promise<void>;

    // Port management
    getOpenPorts(workspaceId: string): Promise<WorkspaceInstancePort[]>;
    openPort(workspaceId: string, port: WorkspaceInstancePort): Promise<WorkspaceInstancePort | undefined>;
    closePort(workspaceId: string, port: number): Promise<void>;

    // User storage
    getUserStorageResource(options: GitpodServer.GetUserStorageResourceOptions): Promise<string>;
    updateUserStorageResource(options: GitpodServer.UpdateUserStorageResourceOptions): Promise<void>;

    // User env vars
    getEnvVars(): Promise<UserEnvVarValue[]>;
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
    getTeams(): Promise<Team[]>;
    getTeamMembers(teamId: string): Promise<TeamMemberInfo[]>;
    createTeam(name: string): Promise<Team>;
    joinTeam(inviteId: string): Promise<Team>;
    setTeamMemberRole(teamId: string, userId: string, role: TeamMemberRole): Promise<void>;
    removeTeamMember(teamId: string, userId: string): Promise<void>;
    getGenericInvite(teamId: string): Promise<TeamMembershipInvite>;
    resetGenericInvite(inviteId: string): Promise<TeamMembershipInvite>;
    deleteTeam(teamId: string): Promise<void>;

    // Projects
    getProviderRepositoriesForUser(params: GetProviderRepositoriesParams): Promise<ProviderRepository[]>;
    createProject(params: CreateProjectParams): Promise<Project>;
    deleteProject(projectId: string): Promise<void>;
    getTeamProjects(teamId: string): Promise<Project[]>;
    getUserProjects(): Promise<Project[]>;
    getProjectOverview(projectId: string): Promise<Project.Overview | undefined>;
    getPrebuildEvents(projectId: string): Promise<PrebuildEvent[]>;
    findPrebuilds(params: FindPrebuildsParams): Promise<PrebuildWithStatus[]>;
    findPrebuildByWorkspaceID(workspaceId: string): Promise<PrebuiltWorkspace | undefined>;
    getPrebuild(prebuildId: string): Promise<PrebuildWithStatus | undefined>;
    triggerPrebuild(projectId: string, branchName: string | null): Promise<StartPrebuildResult>;
    cancelPrebuild(projectId: string, prebuildId: string): Promise<void>;
    updateProjectPartial(partialProject: PartialProject): Promise<void>;
    setProjectEnvironmentVariable(projectId: string, name: string, value: string, censored: boolean): Promise<void>;
    getProjectEnvironmentVariables(projectId: string): Promise<ProjectEnvVar[]>;
    deleteProjectEnvironmentVariable(variableId: string): Promise<void>;

    // content service
    getContentBlobUploadUrl(name: string): Promise<string>;
    getContentBlobDownloadUrl(name: string): Promise<string>;

    // Gitpod token
    getGitpodTokens(): Promise<GitpodToken[]>;
    generateNewGitpodToken(options: GitpodServer.GenerateNewGitpodTokenOptions): Promise<string>;
    deleteGitpodToken(tokenHash: string): Promise<void>;

    // misc
    isGitHubAppEnabled(): Promise<boolean>;
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
     * gitpod.io concerns
     */
    isStudent(): Promise<boolean>;
    /**
     *
     */
    getAccountStatement(options: GitpodServer.GetAccountStatementOptions): Promise<AccountStatement | undefined>;
    getRemainingUsageHours(): Promise<number>;

    /**
     *
     */
    getChargebeeSiteId(): Promise<string>;
    createPortalSession(): Promise<{}>;
    createTeamPortalSession(teamId: string): Promise<{}>;
    checkout(planId: string, planQuantity?: number): Promise<{}>;
    teamCheckout(teamId: string, planId: string): Promise<{}>;
    getAvailableCoupons(): Promise<PlanCoupon[]>;
    getAppliedCoupons(): Promise<PlanCoupon[]>;

    getShowPaymentUI(): Promise<boolean>;
    isChargebeeCustomer(): Promise<boolean>;

    subscriptionUpgradeTo(subscriptionId: string, chargebeePlanId: string): Promise<void>;
    subscriptionDowngradeTo(subscriptionId: string, chargebeePlanId: string): Promise<void>;
    subscriptionCancel(subscriptionId: string): Promise<void>;
    subscriptionCancelDowngrade(subscriptionId: string): Promise<void>;

    getTeamSubscription(teamId: string): Promise<TeamSubscription2 | undefined>;
    tsGet(): Promise<TeamSubscription[]>;
    tsGetSlots(): Promise<TeamSubscriptionSlotResolved[]>;
    tsGetUnassignedSlot(teamSubscriptionId: string): Promise<TeamSubscriptionSlot | undefined>;
    tsAddSlots(teamSubscriptionId: string, quantity: number): Promise<void>;
    tsAssignSlot(
        teamSubscriptionId: string,
        teamSubscriptionSlotId: string,
        identityStr: string | undefined,
    ): Promise<void>;
    tsReassignSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string, newIdentityStr: string): Promise<void>;
    tsDeactivateSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void>;
    tsReactivateSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void>;

    getGithubUpgradeUrls(): Promise<GithubUpgradeURL[]>;

    getStripePublishableKey(): Promise<string>;
    getStripeSetupIntentClientSecret(): Promise<string>;
    findStripeSubscriptionId(attributionId: string): Promise<string | undefined>;
    createStripeCustomerIfNeeded(attributionId: string, currency: string): Promise<void>;
    subscribeToStripe(attributionId: string, setupIntentId: string, usageLimit: number): Promise<number | undefined>;
    getStripePortalUrl(attributionId: string): Promise<string>;
    getCostCenter(attributionId: string): Promise<CostCenterJSON | undefined>;
    setUsageLimit(attributionId: string, usageLimit: number): Promise<void>;
    getUsageBalance(attributionId: string): Promise<number>;

    listUsage(req: ListUsageRequest): Promise<ListUsageResponse>;

    setUsageAttribution(usageAttribution: string): Promise<void>;
    listAvailableUsageAttributionIds(): Promise<string[]>;

    getBillingModeForUser(): Promise<BillingMode>;
    getBillingModeForTeam(teamId: string): Promise<BillingMode>;

    /**
     * Analytics
     */
    trackEvent(event: RemoteTrackMessage): Promise<void>;
    trackLocation(event: RemotePageMessage): Promise<void>;
    identifyUser(event: RemoteIdentifyMessage): Promise<void>;

    /**
     * Frontend notifications
     */
    getNotifications(): Promise<string[]>;

    getSupportedWorkspaceClasses(): Promise<SupportedWorkspaceClass[]>;
}

export interface RateLimiterError {
    method?: string;

    /**
     * Retry after this many seconds, earliest.
     * cmp.: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
     */
    retryAfter: number;
}

export interface CreateProjectParams {
    name: string;
    slug: string;
    cloneUrl: string;
    teamId?: string;
    userId?: string;
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

    inUse?: { userName: string };
}

export interface ClientHeaderFields {
    ip?: string;
    userAgent?: string;
    dnt?: string;
    clientRegion?: string;
}

export const WORKSPACE_TIMEOUT_DEFAULT_SHORT = "short";
export const WORKSPACE_TIMEOUT_DEFAULT_LONG = "long";
export const WORKSPACE_TIMEOUT_EXTENDED = "extended";
export const WORKSPACE_TIMEOUT_EXTENDED_ALT = "180m"; // for backwards compatibility since the IDE uses this
export const WorkspaceTimeoutValues = [
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_EXTENDED,
    WORKSPACE_TIMEOUT_EXTENDED_ALT,
] as const;

export const createServiceMock = function <C extends GitpodClient, S extends GitpodServer>(
    methods: Partial<JsonRpcProxy<S>>,
): GitpodServiceImpl<C, S> {
    return new GitpodServiceImpl<C, S>(createServerMock(methods));
};

export const createServerMock = function <C extends GitpodClient, S extends GitpodServer>(
    methods: Partial<JsonRpcProxy<S>>,
): JsonRpcProxy<S> {
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

type WorkspaceTimeoutDurationTuple = typeof WorkspaceTimeoutValues;
export type WorkspaceTimeoutDuration = WorkspaceTimeoutDurationTuple[number];

export interface SetWorkspaceTimeoutResult {
    resetTimeoutOnWorkspaces: string[];
}

export interface GetWorkspaceTimeoutResult {
    duration: WorkspaceTimeoutDuration;
    durationRaw: string;
    canChange: boolean;
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
    }
    export interface GetAccountStatementOptions {
        date?: string;
    }
    export interface CreateWorkspaceOptions {
        contextUrl: string;
        // whether running workspaces on the same context should be ignored. If false (default) users will be asked.
        ignoreRunningWorkspaceOnSameCommit?: boolean;
        ignoreRunningPrebuild?: boolean;
        allowUsingPreviousPrebuilds?: boolean;
        forceDefaultConfig?: boolean;
    }
    export interface StartWorkspaceOptions {
        forceDefaultImage: boolean;
    }
    export interface TakeSnapshotOptions {
        workspaceId: string;
        /* this is here to enable backwards-compatibility and untangling rollout between workspace, IDE and meta */
        dontWait?: boolean;
    }
    export interface GetUserStorageResourceOptions {
        readonly uri: string;
    }
    export interface UpdateUserStorageResourceOptions {
        readonly uri: string;
        readonly content: string;
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
    export type AdmissionLevel = "owner" | "everyone";
    export type PinAction = "pin" | "unpin" | "toggle";
    export interface GenerateNewGitpodTokenOptions {
        name?: string;
        type: GitpodTokenType;
        scopes?: string[];
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

    onCreditAlert(creditAlert: CreditAlert): void {
        for (const client of this.clients) {
            if (client.onCreditAlert) {
                try {
                    client.onCreditAlert(creditAlert);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    onNotificationUpdated(): void {
        for (const client of this.clients) {
            if (client.onNotificationUpdated) {
                try {
                    client.onNotificationUpdated();
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

export function createGitpodService<C extends GitpodClient, S extends GitpodServer>(
    serverUrl: string | Promise<string>,
) {
    const toWsUrl = (serverUrl: string) => {
        return new GitpodHostUrl(serverUrl).asWebsocket().withApi({ pathname: GitpodServerPath }).toString();
    };
    let url: string | Promise<string>;
    if (typeof serverUrl === "string") {
        url = toWsUrl(serverUrl);
    } else {
        url = serverUrl.then((url) => toWsUrl(url));
    }

    const connectionProvider = new WebSocketConnectionProvider();
    let onReconnect = () => {};
    const gitpodServer = connectionProvider.createProxy<S>(url, undefined, {
        onListening: (socket) => {
            onReconnect = () => socket.reconnect();
        },
    });
    return new GitpodServiceImpl<C, S>(gitpodServer, { onReconnect });
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    User, WorkspaceInfo, WorkspaceCreationResult, UserMessage, WorkspaceInstanceUser,
    WhitelistedRepository, WorkspaceImageBuild, AuthProviderInfo, Branding, CreateWorkspaceMode,
    Token, UserEnvVarValue, ResolvePluginsParams, PreparePluginUploadParams, Terms,
    ResolvedPlugins, Configuration, InstallPluginsParams, UninstallPluginParams, UserInfo, GitpodTokenType, GitpodToken, AuthProviderEntry
} from './protocol';
import { JsonRpcProxy, JsonRpcServer } from './messaging/proxy-factory';
import { Disposable, CancellationTokenSource } from 'vscode-jsonrpc';
import { HeadlessLogEvent } from './headless-workspace-log';
import { WorkspaceInstance, WorkspaceInstancePort, WorkspaceInstancePhase } from './workspace-instance';
import { AdminServer } from './admin-protocol';
import { GitpodHostUrl } from './util/gitpod-host-url';
import { WebSocketConnectionProvider } from './messaging/browser/connection';
import { PermissionName } from './permission';
import { LicenseService } from './license-protocol';
import { Emitter } from './util/event';
import { AccountStatement, CreditAlert } from './accounting-protocol';
import { GithubUpgradeURL, PlanCoupon } from './payment-protocol';
import { TeamSubscription, TeamSubscriptionSlot, TeamSubscriptionSlotResolved } from './team-subscription-protocol';

export interface GitpodClient {
    onInstanceUpdate(instance: WorkspaceInstance): void;
    onWorkspaceImageBuildLogs: WorkspaceImageBuild.LogCallback;
    onHeadlessWorkspaceLogs(evt: HeadlessLogEvent): void;

    onCreditAlert(creditAlert: CreditAlert): void;

    //#region propagating reconnection to iframe
    notifyDidOpenConnection(): void;
    notifyDidCloseConnection(): void;
    //#endregion
}

export const GitpodServer = Symbol('GitpodServer');
export interface GitpodServer extends JsonRpcServer<GitpodClient>, AdminServer, LicenseService {
    // User related API
    getLoggedInUser(): Promise<User>;
    getTerms(): Promise<Terms>;
    updateLoggedInUser(user: Partial<User>): Promise<User>;
    getAuthProviders(): Promise<AuthProviderInfo[]>;
    getOwnAuthProviders(): Promise<AuthProviderEntry[]>;
    updateOwnAuthProvider(params: GitpodServer.UpdateOwnAuthProviderParams): Promise<void>;
    deleteOwnAuthProvider(params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void>;
    getBranding(): Promise<Branding>;
    getConfiguration(): Promise<Configuration>;
    getToken(query: GitpodServer.GetTokenSearchOptions): Promise<Token | undefined>;
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
    getWorkspace(id: string): Promise<WorkspaceInfo>;
    isWorkspaceOwner(workspaceId: string): Promise<boolean>;

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
    watchHeadlessWorkspaceLogs(workspaceId: string): Promise<void>;
    isPrebuildDone(pwsid: string): Promise<boolean>;

    // Workspace timeout
    setWorkspaceTimeout(workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult>;
    getWorkspaceTimeout(workspaceId: string): Promise<GetWorkspaceTimeoutResult>;
    sendHeartBeat(options: GitpodServer.SendHeartBeatOptions): Promise<void>;

    updateWorkspaceUserPin(id: string, action: GitpodServer.PinAction): Promise<void>;

    // Port management
    getOpenPorts(workspaceId: string): Promise<WorkspaceInstancePort[]>;
    openPort(workspaceId: string, port: WorkspaceInstancePort): Promise<WorkspaceInstancePort | undefined>;
    closePort(workspaceId: string, port: number): Promise<void>;

    // User messages
    getUserMessages(options: GitpodServer.GetUserMessagesOptions): Promise<UserMessage[]>;
    updateUserMessages(options: GitpodServer.UpdateUserMessagesOptions): Promise<void>;

    // User storage
    getUserStorageResource(options: GitpodServer.GetUserStorageResourceOptions): Promise<string>;
    updateUserStorageResource(options: GitpodServer.UpdateUserStorageResourceOptions): Promise<void>;

    // user env vars
    getEnvVars(): Promise<UserEnvVarValue[]>;
    setEnvVar(variable: UserEnvVarValue): Promise<void>;
    deleteEnvVar(variable: UserEnvVarValue): Promise<void>;

    // content service
    getContentBlobUploadUrl(name: string): Promise<string>
    getContentBlobDownloadUrl(name: string): Promise<string>

    // Gitpod token
    getGitpodTokens(): Promise<GitpodToken[]>;
    generateNewGitpodToken(options: GitpodServer.GenerateNewGitpodTokenOptions): Promise<string>;
    deleteGitpodToken(tokenHash: string): Promise<void>;

    // misc
    sendFeedback(feedback: string): Promise<string | undefined>;
    registerGithubApp(installationId: string): Promise<void>;

    /**
     * Stores a new snapshot for the given workspace and bucketId
     * @return the snapshot id
     */
    takeSnapshot(options: GitpodServer.TakeSnapshotOptions): Promise<string>;

    /**
     * Returns the list of snapshots that exist for a workspace.
     */
    getSnapshots(workspaceID: string): Promise<string[]>;

    /**
     * stores/updates layout information for the given workspace
     */
    storeLayout(workspaceId: string, layoutData: string): Promise<void>;

    /**
     * retrieves layout information for the given workspace
     */
    getLayout(workspaceId: string): Promise<string | undefined>;

    /**
     * @param params
     * @returns promise resolves to an URL to be used for the upload
     */
    preparePluginUpload(params: PreparePluginUploadParams): Promise<string>
    resolvePlugins(workspaceId: string, params: ResolvePluginsParams): Promise<ResolvedPlugins>;
    installUserPlugins(params: InstallPluginsParams): Promise<boolean>;
    uninstallUserPlugin(params: UninstallPluginParams): Promise<boolean>;

    /**
     * gitpod.io concerns
     */
    isStudent(): Promise<boolean>;
    getPrivateRepoTrialEndDate(): Promise<string | undefined>;

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
    checkout(planId: string, planQuantity?: number): Promise<{}>;
    getAvailableCoupons(): Promise<PlanCoupon[]>;
    getAppliedCoupons(): Promise<PlanCoupon[]>;

    getShowPaymentUI(): Promise<boolean>;
    isChargebeeCustomer(): Promise<boolean>;
    mayAccessPrivateRepo(): Promise<boolean>;

    subscriptionUpgradeTo(subscriptionId: string, chargebeePlanId: string): Promise<void>;
    subscriptionDowngradeTo(subscriptionId: string, chargebeePlanId: string): Promise<void>;
    subscriptionCancel(subscriptionId: string): Promise<void>;
    subscriptionCancelDowngrade(subscriptionId: string): Promise<void>;

    tsGet(): Promise<TeamSubscription[]>;
    tsGetSlots(): Promise<TeamSubscriptionSlotResolved[]>;
    tsGetUnassignedSlot(teamSubscriptionId: string): Promise<TeamSubscriptionSlot | undefined>
    tsAddSlots(teamSubscriptionId: string, quantity: number): Promise<void>;
    tsAssignSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string, identityStr: string|undefined): Promise<void>
    tsReassignSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string, newIdentityStr: string): Promise<void>;
    tsDeactivateSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void>;
    tsReactivateSlot(teamSubscriptionId: string, teamSubscriptionSlotId: string): Promise<void>;

    getGithubUpgradeUrls(): Promise<GithubUpgradeURL[]>;

}

export const WorkspaceTimeoutValues = ["30m", "60m", "180m"] as const;

export const createServiceMock = function <C extends GitpodClient, S extends GitpodServer>(methods: Partial<JsonRpcProxy<S>>): GitpodServiceImpl<C, S> {
    return new GitpodServiceImpl<C, S>(createServerMock(methods));
}

export const createServerMock = function <C extends GitpodClient, S extends GitpodServer>(methods: Partial<JsonRpcProxy<S>>): JsonRpcProxy<S> {
    methods.setClient = methods.setClient || (() => { });
    methods.dispose = methods.dispose || (() => { });
    return new Proxy<JsonRpcProxy<S>>(methods as any as JsonRpcProxy<S>, {
        get: (target: S, property: keyof S) => {
            const result = target[property];
            if (!result) {
                throw new Error(`Method ${property} not implemented`);
            }
            return result;
        }
    });
}

type WorkspaceTimeoutDurationTuple = typeof WorkspaceTimeoutValues;
export type WorkspaceTimeoutDuration = WorkspaceTimeoutDurationTuple[number];

export interface SetWorkspaceTimeoutResult {
    resetTimeoutOnWorkspaces: string[]
}

export interface GetWorkspaceTimeoutResult {
    duration: WorkspaceTimeoutDuration
    canChange: boolean
}

export interface StartWorkspaceResult {
    instanceID: string
    workspaceURL?: string
}

export namespace GitpodServer {
    export interface GetWorkspacesOptions {
        limit?: number;
        searchString?: string;
        pinnedOnly?: boolean;
    }
    export interface GetAccountStatementOptions {
        date?: string;
    }
    export interface CreateWorkspaceOptions {
        contextUrl: string;
        mode?: CreateWorkspaceMode;
    }
    export interface StartWorkspaceOptions {
        forceDefaultImage: boolean;
    }
    export interface TakeSnapshotOptions {
        workspaceId: string;
        layoutData?: string;
    }
    export interface GetUserMessagesOptions {
        readonly releaseNotes?: boolean;
        readonly workspaceInstanceId: string;
    }
    export interface UpdateUserMessagesOptions {
        readonly messageIds: string[];
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
        readonly entry: AuthProviderEntry.UpdateEntry | AuthProviderEntry.NewEntry
    }
    export interface DeleteOwnAuthProviderParams {
        readonly id: string
    }
    export type AdmissionLevel = "owner" | "everyone";
    export type PinAction = "pin" | "unpin" | "toggle";
    export interface GenerateNewGitpodTokenOptions {
        name?: string
        type: GitpodTokenType
        scopes?: string[]
    }
}

export const GitpodServerPath = '/gitpod';

export const GitpodServerProxy = Symbol('GitpodServerProxy');
export type GitpodServerProxy<S extends GitpodServer> = JsonRpcProxy<S>;

export class GitpodCompositeClient<Client extends GitpodClient> implements GitpodClient {
    protected clients: Partial<Client>[] = [];

    public registerClient(client: Partial<Client>): Disposable {
        this.clients.push(client);
        const index = this.clients.length;
        return {
            dispose: () => {
                this.clients.slice(index, 1);
            }
        }
    }

    onInstanceUpdate(instance: WorkspaceInstance): void {
        for (const client of this.clients) {
            if (client.onInstanceUpdate) {
                try {
                    client.onInstanceUpdate(instance);
                } catch (error) {
                    console.error(error)
                }
            }
        }
    }

    onWorkspaceImageBuildLogs(info: WorkspaceImageBuild.StateInfo, content: WorkspaceImageBuild.LogContent | undefined): void {
        for (const client of this.clients) {
            if (client.onWorkspaceImageBuildLogs) {
                try {
                    client.onWorkspaceImageBuildLogs(info, content);
                } catch (error) {
                    console.error(error)
                }
            }
        }
    }

    onHeadlessWorkspaceLogs(evt: HeadlessLogEvent): void {
        for (const client of this.clients) {
            if (client.onHeadlessWorkspaceLogs) {
                try {
                    client.onHeadlessWorkspaceLogs(evt);
                } catch (error) {
                    console.error(error)
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
                    console.error(error)
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
                    console.error(error)
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
                    console.error(error)
                }
            }
        }
    }

}

export type GitpodService = GitpodServiceImpl<GitpodClient, GitpodServer>;

const hasWindow = (typeof window !== 'undefined');
const phasesOrder: Record<WorkspaceInstancePhase, number> = {
    unknown: 0,
    preparing: 1,
    pending: 2,
    creating: 3,
    initializing: 4,
    running: 5,
    interrupted: 6,
    stopping: 7,
    stopped: 8
};
export class WorkspaceInstanceUpdateListener {
    private readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;

    private source: 'sync' | 'update' = 'sync';

    get info(): WorkspaceInfo {
        return this._info;
    }

    constructor(
        private readonly service: GitpodService,
        private _info: WorkspaceInfo
    ) {
        service.registerClient({
            onInstanceUpdate: instance => {
                if (this.isOutOfOrder(instance)) {
                    return;
                }
                this.cancelSync();
                this._info.latestInstance = instance;
                this.source = 'update';
                this.onDidChangeEmitter.fire(undefined);
            },
            notifyDidOpenConnection: () => {
                this.sync();
            }
        });
        if (hasWindow) {
            // learn about page lifecycle here: https://developers.google.com/web/updates/2018/07/page-lifecycle-api
            window.document.addEventListener('visibilitychange', async () => {
                if (window.document.visibilityState === 'visible') {
                    this.sync();
                }
            });
            window.addEventListener('pageshow', e => {
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
                this.source = 'sync';
                this.onDidChangeEmitter.fire(undefined);
            } catch (e) {
                console.error('failed to sync workspace instance:', e)
            }
        })
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
        if (this.source === 'update') {
            return false;
        }
        if (instance.id !== this.info.latestInstance?.id) {
            return false;
        }
        return phasesOrder[instance.status.phase] < phasesOrder[this.info.latestInstance.status.phase];
    }

}

export class GitpodServiceImpl<Client extends GitpodClient, Server extends GitpodServer> {

    private readonly compositeClient = new GitpodCompositeClient<Client>();

    constructor(public readonly server: JsonRpcProxy<Server>) {
        server.setClient(this.compositeClient);
        server.onDidOpenConnection(() => this.compositeClient.notifyDidOpenConnection());
        server.onDidCloseConnection(() => this.compositeClient.notifyDidCloseConnection());
    }

    public registerClient(client: Partial<Client>): Disposable {
        return this.compositeClient.registerClient(client);
    }

    private readonly instanceListeners = new Map<string, Promise<WorkspaceInstanceUpdateListener>>();
    listenToInstance(workspaceId: string): Promise<WorkspaceInstanceUpdateListener> {
        const listener = this.instanceListeners.get(workspaceId) ||
            (async () => {
                const info = await this.server.getWorkspace(workspaceId);
                return new WorkspaceInstanceUpdateListener(this, info);
            })();
        this.instanceListeners.set(workspaceId, listener);
        return listener;
    }
}

export function createGitpodService<C extends GitpodClient, S extends GitpodServer>(serverUrl: string) {
    const url = new GitpodHostUrl(serverUrl)
        .asWebsocket()
        .withApi({ pathname: GitpodServerPath });
    const connectionProvider = new WebSocketConnectionProvider();
    const gitpodServer = connectionProvider.createProxy<S>(url.toString());
    return new GitpodServiceImpl<C, S>(gitpodServer);
}
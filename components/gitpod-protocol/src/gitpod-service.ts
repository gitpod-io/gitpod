/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, WorkspaceInfo, WorkspaceCreationResult, UserMessage, WorkspaceInstanceUser,
    WhitelistedRepository, WorkspaceImageBuild, AuthProviderInfo, Branding, CreateWorkspaceMode,
    Token, UserEnvVarValue, ResolvePluginsParams, PreparePluginUploadParams,
    ResolvedPlugins, Configuration, InstallPluginsParams, UninstallPluginParams, UserInfo, GitpodTokenType, GitpodToken, AuthProviderEntry, WorkspaceConfig } from './protocol';
import { JsonRpcProxy, JsonRpcServer } from './messaging/proxy-factory';
import { injectable, inject } from 'inversify';
import { Disposable } from 'vscode-jsonrpc';
import { HeadlessLogEvent } from './headless-workspace-log';
import { WorkspaceInstance, WorkspaceInstancePort } from './workspace-instance';
import { AdminServer } from './admin-protocol';
import { GitpodHostUrl } from './util/gitpod-host-url';
import { WebSocketConnectionProvider } from './messaging/browser/connection';
import { PermissionName } from './permission';
import { LicenseService } from './license-protocol';

export interface GitpodClient {
    onInstanceUpdate(instance: WorkspaceInstance): void;
    onWorkspaceImageBuildLogs: WorkspaceImageBuild.LogCallback;
    onHeadlessWorkspaceLogs(evt: HeadlessLogEvent): void;
}

export const GitpodServer = Symbol('GitpodServer');

export interface GitpodServer extends JsonRpcServer<GitpodClient>, AdminServer, LicenseService {
    // User related API
    getLoggedInUser(params: GitpodServer.GetLoggedInUserParams): Promise<User>;
    updateLoggedInUser(params: GitpodServer.UpdateLoggedInUserParams): Promise<User>;
    getAuthProviders(params: GitpodServer.GetAuthProvidersParams): Promise<AuthProviderInfo[]>;
    getOwnAuthProviders(params: GitpodServer.GetOwnAuthProvidersParams): Promise<AuthProviderEntry[]>;
    updateOwnAuthProvider(params: GitpodServer.UpdateOwnAuthProviderParams): Promise<void>;
    deleteOwnAuthProvider(params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void>;
    getBranding(params: GitpodServer.GetBrandingParams): Promise<Branding>;
    getConfiguration(params: GitpodServer.GetConfigurationParams): Promise<Configuration>;
    getToken(params: GitpodServer.GetTokenParams): Promise<Token | undefined>;
    getPortAuthenticationToken(params: GitpodServer.GetPortAuthenticationTokenParams): Promise<Token>;
    deleteAccount(params: GitpodServer.DeleteAccountParams): Promise<void>;
    getClientRegion(params: GitpodServer.GetClientRegionParams): Promise<string | undefined>;
    hasPermission(params: GitpodServer.HasPermissionParams): Promise<boolean>;

    // Query/retrieve workspaces
    getWorkspaces(params: GitpodServer.GetWorkspacesParams): Promise<WorkspaceInfo[]>;
    getWorkspaceOwner(params: GitpodServer.GetWorkspaceOwnerParams): Promise<UserInfo | undefined>;
    getWorkspaceUsers(params: GitpodServer.GetWorkspaceUsersParams): Promise<WorkspaceInstanceUser[]>;
    getFeaturedRepositories(params: GitpodServer.GetFeaturedRepositoriesParams): Promise<WhitelistedRepository[]>;
    getWorkspace(params: GitpodServer.GetWorkspaceParams): Promise<WorkspaceInfo>;
    isWorkspaceOwner(params: GitpodServer.IsWorkspaceOwnerParams): Promise<boolean>;

    /**
     * Creates and starts a workspace for the given context URL.
     * @param options GitpodServer.CreateWorkspaceOptions
     * @return WorkspaceCreationResult
     */
    createWorkspace(params: GitpodServer.CreateWorkspaceParams): Promise<WorkspaceCreationResult>;
    startWorkspace(params: GitpodServer.StartWorkspaceParams): Promise<StartWorkspaceResult>;
    stopWorkspace(params: GitpodServer.StopWorkspaceParams): Promise<void>;
    deleteWorkspace(params: GitpodServer.DeleteWorkspaceParams): Promise<void>;
    setWorkspaceDescription(params: GitpodServer.SetWorkspaceDescriptionParams): Promise<void>;
    controlAdmission(params: GitpodServer.ControlAdmissionParams): Promise<void>;

    updateWorkspaceUserPin(params: GitpodServer.UpdateWorkspaceUserPinParams): Promise<void>;
    sendHeartBeat(params: GitpodServer.SendHeartBeatParams): Promise<void>;
    watchWorkspaceImageBuildLogs(params: GitpodServer.WatchWorkspaceImageBuildLogsParams): Promise<void>;
    watchHeadlessWorkspaceLogs(params: GitpodServer.WatchHeadlessWorkspaceLogsParams): Promise<void>;
    isPrebuildAvailable(params: GitpodServer.IsPrebuildAvailableParams): Promise<boolean>;

    // Workspace timeout
    setWorkspaceTimeout(params: GitpodServer.SetWorkspaceTimeoutParams): Promise<SetWorkspaceTimeoutResult>;
    getWorkspaceTimeout(params: GitpodServer.GetWorkspaceTimeoutParams): Promise<GetWorkspaceTimeoutResult>;
    sendHeartBeat(params: GitpodServer.SendHeartBeatParams): Promise<void>;

    updateWorkspaceUserPin(params: GitpodServer.UpdateWorkspaceUserPinParams): Promise<void>;

    // Port management
    getOpenPorts(params: GitpodServer.GetOpenPortsParams): Promise<WorkspaceInstancePort[]>;
    openPort(params: GitpodServer.OpenPortParams): Promise<WorkspaceInstancePort | undefined>;
    closePort(params: GitpodServer.ClosePortParams): Promise<void>;

    // User messages
    getUserMessages(params: GitpodServer.GetUserMessagesParams): Promise<UserMessage[]>;
    updateUserMessages(params: GitpodServer.UpdateUserMessagesParams): Promise<void>;

    // User storage
    getUserStorageResource(params: GitpodServer.GetUserStorageResourceParams): Promise<string>;
    updateUserStorageResource(params: GitpodServer.UpdateUserStorageResourceParams): Promise<void>;

    // user env vars
    getEnvVars(params: GitpodServer.GetEnvVarsParams): Promise<UserEnvVarValue[]>;
    setEnvVar(params: GitpodServer.SetEnvVarParams): Promise<void>;
    deleteEnvVar(params: GitpodServer.DeleteEnvVarParams): Promise<void>;

    // Gitpod token
    getGitpodTokens(params: GitpodServer.GetGitpodTokensParams): Promise<GitpodToken[]>;
    generateNewGitpodToken(params: GitpodServer.GenerateNewGitpodTokenParams): Promise<string>;
    deleteGitpodToken(params: GitpodServer.DeleteGitpodTokenParams): Promise<void>;

    // misc
    sendFeedback(params: GitpodServer.SendFeedbackParams): Promise<string | undefined>;
    registerGithubApp(params: GitpodServer.RegisterGithubAppParams): Promise<void>;

    /**
     * Stores a new snapshot for the given workspace and bucketId
     * @return the snapshot id
     */
    takeSnapshot(params: GitpodServer.TakeSnapshotParams): Promise<string>;

    /**
     * Returns the list of snapshots that exist for a workspace.
     */
    getSnapshots(params: GitpodServer.GetSnapshotsParams): Promise<string[]>;

    /**
     * stores/updates layout information for the given workspace
     */
    storeLayout(params: GitpodServer.StoreLayoutParams): Promise<void>;

    /**
     * retrieves layout information for the given workspace
     */
    getLayout(params: GitpodServer.GetLayoutParams): Promise<string | undefined>;

    /**
     * @param params
     * @returns promise resolves to an URL to be used for the upload
     */
    preparePluginUpload(params: GitpodServer.PreparePluginUploadParams): Promise<string>
    resolvePlugins(params: GitpodServer.ResolvePluginsParams): Promise<ResolvedPlugins>;
    installUserPlugins(params: GitpodServer.InstallUserPluginsParams): Promise<boolean>;
    uninstallUserPlugin(params: GitpodServer.UninstallUserPluginParams): Promise<boolean>;
}


export interface GitpodServerV0 extends JsonRpcServer<GitpodClient>, AdminServer, LicenseService {
    // User related API
    getLoggedInUser(): Promise<User>;
    updateLoggedInUser(user: Partial<User>): Promise<User>;
    getAuthProviders(): Promise<AuthProviderInfo[]>;
    getOwnAuthProviders(): Promise<AuthProviderEntry[]>;
    updateOwnAuthProvider(params: GitpodServer.UpdateOwnAuthProviderParams): Promise<void>;
    deleteOwnAuthProvider(params: GitpodServer.DeleteOwnAuthProviderParams): Promise<void>;
    getBranding(): Promise<Branding>;
    getConfiguration(): Promise<Configuration>;
    getToken(query: GitpodServerV0.GetTokenSearchOptions): Promise<Token | undefined>;
    getPortAuthenticationToken(workspaceId: string): Promise<Token>;
    deleteAccount(): Promise<void>;
    getClientRegion(): Promise<string | undefined>;
    hasPermission(permission: PermissionName): Promise<boolean>;

    // Query/retrieve workspaces
    getWorkspaces(options: GitpodServerV0.GetWorkspacesOptions): Promise<WorkspaceInfo[]>;
    getWorkspaceOwner(workspaceId: string): Promise<UserInfo | undefined>;
    getWorkspaceUsers(workspaceId: string): Promise<WorkspaceInstanceUser[]>;
    getFeaturedRepositories(): Promise<WhitelistedRepository[]>;
    getWorkspace(id: string): Promise<WorkspaceInfo>;
    isWorkspaceOwner(workspaceId: string): Promise<boolean>;

    /**
     * Creates and starts a workspace for the given context URL.
     * @param options GitpodServer.CreateWorkspaceOptions
     * @return WorkspaceCreationResult
     */
    createWorkspace(options: GitpodServerV0.CreateWorkspaceOptions): Promise<WorkspaceCreationResult>;
    startWorkspace(id: string, options: {forceDefaultImage: boolean}): Promise<StartWorkspaceResult>;
    stopWorkspace(id: string): Promise<void>;
    deleteWorkspace(id: string): Promise<void>;
    setWorkspaceDescription(id: string, desc: string): Promise<void>;
    controlAdmission(id: string, level: "owner" | "everyone"): Promise<void>;

    updateWorkspaceUserPin(id: string, action: "pin" | "unpin" | "toggle"): Promise<void>;
    sendHeartBeat(options: GitpodServerV0.SendHeartBeatOptions): Promise<void>;
    watchWorkspaceImageBuildLogs(workspaceId: string): Promise<void>;
    watchHeadlessWorkspaceLogs(workspaceId: string): Promise<void>;
    isPrebuildAvailable(pwsid: string): Promise<boolean>;
    
    // Workspace timeout
    setWorkspaceTimeout(workspaceId: string, duration: WorkspaceTimeoutDuration): Promise<SetWorkspaceTimeoutResult>;
    getWorkspaceTimeout(workspaceId: string): Promise<GetWorkspaceTimeoutResult>;
    sendHeartBeat(options: GitpodServerV0.SendHeartBeatOptions): Promise<void>;

    updateWorkspaceUserPin(id: string, action: "pin" | "unpin" | "toggle"): Promise<void>;

    // Port management
    getOpenPorts(workspaceId: string): Promise<WorkspaceInstancePort[]>;
    openPort(workspaceId: string, port: WorkspaceInstancePort): Promise<WorkspaceInstancePort | undefined>;
    closePort(workspaceId: string, port: number): Promise<void>;

    // User messages
    getUserMessages(options: GitpodServerV0.GetUserMessagesOptions): Promise<UserMessage[]>;
    updateUserMessages(options: GitpodServerV0.UpdateUserMessagesOptions): Promise<void>;

    // User storage
    getUserStorageResource(options: GitpodServerV0.GetUserStorageResourceOptions): Promise<string>;
    updateUserStorageResource(options: GitpodServerV0.UpdateUserStorageResourceOptions): Promise<void>;

    // user env vars
    getEnvVars(): Promise<UserEnvVarValue[]>;
    setEnvVar(variable: UserEnvVarValue): Promise<void>;
    deleteEnvVar(variable: UserEnvVarValue): Promise<void>;

    // Gitpod token
    getGitpodTokens(): Promise<GitpodToken[]>;
    generateNewGitpodToken(options: { name?: string, type: GitpodTokenType, scopes?: [] }): Promise<string>;
    deleteGitpodToken(tokenHash: string): Promise<void>;

    // misc
    sendFeedback(feedback: string): Promise<string | undefined>;
    registerGithubApp(installationId: string): Promise<void>;

    /**
     * Stores a new snapshot for the given workspace and bucketId
     * @return the snapshot id
     */
    takeSnapshot(options: GitpodServerV0.TakeSnapshotOptions): Promise<string>;

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
}

export const WorkspaceTimeoutValues = ["30m", "60m", "180m"] as const;

export const createServiceMock = function<C extends GitpodClient, S extends GitpodServer>(methods: Partial<JsonRpcProxy<S>>): GitpodServiceImpl<C, S> {
    return new GitpodServiceImpl<C, S>(createServerMock(methods));
}

export const createServerMock = function<C extends GitpodClient, S extends GitpodServer>(methods: Partial<JsonRpcProxy<S>>): JsonRpcProxy<S> {
    methods.setClient = methods.setClient || (() => {});
    methods.dispose = methods.dispose || (() => {});
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
    export interface GetLoggedInUserParams {}

    export interface UpdateLoggedInUserParams {
        readonly user: Partial<User>;
    }

    export interface GetAuthProvidersParams {}

    export interface GetOwnAuthProvidersParams {}

    export interface UpdateOwnAuthProviderParams {
        readonly entry: AuthProviderEntry.UpdateEntry | AuthProviderEntry.NewEntry;
    }

    export interface DeleteOwnAuthProviderParams {
        readonly id: string;
    }

    export interface GetBrandingParams {}

    export interface GetConfigurationParams {}

    export interface GetTokenParams {
        readonly host: string;
    }

    export interface GetPortAuthenticationTokenParams {
        readonly workspaceId: string;
    }

    export interface DeleteAccountParams {}

    export interface GetClientRegionParams {}

    export interface HasPermissionParams {
        readonly permission: PermissionName;
    }

    export interface GetWorkspacesParams {
        readonly limit?: number;
        readonly searchString?: string;
        readonly pinnedOnly?: boolean;
    }

    export interface GetWorkspaceOwnerParams {
        readonly workspaceId: string;
    }

    export interface GetWorkspaceUsersParams {
        readonly workspaceId: string;
    }

    export interface GetFeaturedRepositoriesParams {}

    export interface GetWorkspaceParams {
        readonly workspaceId: string;
    }

    export interface IsWorkspaceOwnerParams {
        readonly workspaceId: string;
    }

    export interface CreateWorkspaceParams {
        readonly contextUrl: string;
        readonly mode?: CreateWorkspaceMode;
    }

    export interface StartWorkspaceParams {
        readonly workspaceId: string;
        readonly forceDefaultImage: boolean
    }

    export interface StopWorkspaceParams {
        readonly workspaceId: string;
    }

    export interface DeleteWorkspaceParams {
        readonly workspaceId: string;
    }

    export interface SetWorkspaceDescriptionParams {
        readonly workspaceId: string;
        readonly desc: string;
    }

    export interface ControlAdmissionParams {
        readonly workspaceId: string;
        readonly level: "owner" | "everyone";
    }

    export interface UpdateWorkspaceUserPinParams {
        readonly workspaceId: string;
        readonly action: "pin" | "unpin" | "toggle";
    }

    export interface SendHeartBeatParams {
        readonly instanceId: string;
        readonly wasClosed?: boolean;
        readonly roundTripTime?: number;
    }

    export interface WatchWorkspaceImageBuildLogsParams {
        readonly workspaceId: string;
    }

    export interface WatchHeadlessWorkspaceLogsParams {
        readonly workspaceId: string;
    }

    export interface IsPrebuildAvailableParams {
        readonly pwsid: string;
    }

    export interface SetWorkspaceTimeoutParams {
        readonly workspaceId: string;
        readonly duration: WorkspaceTimeoutDuration;
    }

    export interface GetWorkspaceTimeoutParams {
        readonly workspaceId: string;
    }

    export interface SendHeartBeatParams {
        readonly instanceId: string;
        readonly wasClosed?: boolean;
        readonly roundTripTime?: number;
    }

    export interface UpdateWorkspaceUserPinParams {
        readonly workspaceId: string;
        readonly action: "pin" | "unpin" | "toggle";
    }

    export interface GetOpenPortsParams {
        readonly workspaceId: string;
    }

    export interface OpenPortParams {
        readonly workspaceId: string;
        readonly port: WorkspaceInstancePort;
    }

    export interface ClosePortParams {
        readonly workspaceId: string;
        readonly port: number;
    }

    export interface GetUserMessagesParams {
        readonly releaseNotes?: boolean;
        readonly workspaceInstanceId: string;
    }

    export interface UpdateUserMessagesParams {
        readonly messageIds: string[];
    }

    export interface GetUserStorageResourceParams {
        readonly uri: string;
    }

    export interface UpdateUserStorageResourceParams {
        readonly uri: string;
        readonly content: string;
    }

    export interface GetEnvVarsParams {}

    export interface SetEnvVarParams {
        readonly variable: UserEnvVarValue;
    }

    export interface DeleteEnvVarParams {
        readonly variable: UserEnvVarValue;
    }

    export interface GetGitpodTokensParams {}

    export interface GenerateNewGitpodTokenParams {
        readonly name?: string;
        readonly type: GitpodTokenType;
        readonly scopes?: string[];
    }

    export interface DeleteGitpodTokenParams {
        readonly tokenHash: string;
    }

    export interface SendFeedbackParams {
        readonly feedback: string;
    }

    export interface RegisterGithubAppParams {
        readonly installationId: string;
    }

    export interface TakeSnapshotParams {
        readonly workspaceId: string;
        readonly layoutData?: string;
    }

    export interface GetSnapshotsParams {
        readonly workspaceId: string;
    }

    export interface StoreLayoutParams {
        readonly workspaceId: string;
        readonly layoutData: string;
    }

    export interface GetLayoutParams {
        readonly workspaceId: string;
    }

    export interface PreparePluginUploadParams {
        readonly fullPluginName: string;
    }

    export interface ResolvePluginsParams {
        readonly workspaceId: string;
        readonly config?: WorkspaceConfig;
        readonly builtins?: ResolvedPlugins;
    }

    export interface InstallUserPluginsParams {
        readonly pluginIds: string[];
    }

    export interface UninstallUserPluginParams {
        readonly pluginId: string;
    }
}

export namespace GitpodServerV0 {
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
}

export const GitpodService = Symbol('GitpodService');
export type GitpodService = GitpodServiceImpl<GitpodClient, GitpodServer>

@injectable()
export class GitpodServiceImpl<Client extends GitpodClient, Server extends GitpodServer> {

    protected compositeClient = new GitpodCompositeClient<Client>();

    constructor(@inject(GitpodServer) public readonly server: JsonRpcProxy<Server>) {
        server.setClient(this.compositeClient);
    }

    public registerClient(client: Partial<Client>): Disposable {
        return this.compositeClient.registerClient(client);
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
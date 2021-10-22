/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceInstance, PortVisibility } from "./workspace-instance";
import { RoleOrPermission } from "./permission";
import { Project } from "./teams-projects-protocol";

export interface UserInfo {
    name?: string
}

export interface User {
    /** The user id */
    id: string

    /** The timestamp when the user entry was created */
    creationDate: string

    avatarUrl?: string

    name?: string

    /** Optional for backwards compatibility */
    fullName?: string

    identities: Identity[]

    /**
     * Whether the user has been blocked to use our service, because of TOS violation for example.
     * Optional for backwards compatibility.
     */
    blocked?: boolean;

    /** A map of random settings that alter the behaviour of Gitpod on a per-user basis */
    featureFlags?: UserFeatureSettings;

    /** The permissions and/or roles the user has */
    rolesOrPermissions?: RoleOrPermission[];

    /** Whether the user is logical deleted. This flag is respected by all queries in UserDB */
    markedDeleted?: boolean;

    additionalData?: AdditionalUserData;
}

export namespace User {
    export function is(data: any): data is User {
        return data
            && data.hasOwnProperty('id')
            && data.hasOwnProperty('identities')
    }
    export function getIdentity(user: User, authProviderId: string): Identity | undefined {
        return user.identities.find(id => id.authProviderId === authProviderId);
    }
    export function censor(user: User): User {
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
    export function getPrimaryEmail(user: User): string {
        const identities = user.identities.filter(i => !!i.primaryEmail);
        if (identities.length <= 0) {
            throw new Error(`No identity with primary email for user: ${user.id}!`);
        }

        return identities[0].primaryEmail!;
    }
    export function getName(user: User): string | undefined {
        const name = user.fullName || user.name;
        if (name) {
            return name;
        }

        for (const id of user.identities) {
            if (id.authName !== "") {
                return id.authName;
            }
        }
        return undefined;
    }
}

export interface AdditionalUserData {
    platforms?: UserPlatform[];
    emailNotificationSettings?: EmailNotificationSettings;
    featurePreview?: boolean;
    ideSettings?: IDESettings;
    // key is the name of the news, string the iso date when it was seen
    whatsNewSeen?: { [key: string]: string }
    // key is the name of the OAuth client i.e. local app, string the iso date when it was approved
    // TODO(rl): provide a management UX to allow rescinding of approval
    oauthClientsApproved?: { [key: string]: string }
    // to remember GH Orgs the user installed/updated the GH App for
    knownGitHubOrgs?: string[];
}

export interface EmailNotificationSettings {
    allowsChangelogMail?: boolean;
    allowsDevXMail?: boolean;
    allowsOnboardingMail?: boolean;
}

export type IDESettings = {
    defaultIde?: string
    useDesktopIde?: boolean
    defaultDesktopIde?: string
}

export interface UserPlatform {
    uid: string;
    userAgent: string;
    browser: string;
    os: string;
    lastUsed: string;
    firstUsed: string;
    /**
     * Since when does the user have the browser extension installe don this device.
     */
    browserExtensionInstalledSince?: string;

    /**
     * Since when does the user not have the browser extension installed anymore (but previously had).
     */
    browserExtensionUninstalledSince?: string;
}

export interface UserFeatureSettings {
    /**
     * This field is used as marker to grant users a free trial for using private repositories,
     * independent of any subscription or Chargebee.
     *  - it is set when the user uses their first private repo
     *  - whether the trial is expired or not is juged by the UserService
     */
    privateRepoTrialStartDate?: string;

    /**
     * Permanent feature flags are added to each and every workspace instance
     * this user starts.
     */
    permanentWSFeatureFlags?: NamedWorkspaceFeatureFlag[];
}

/**
 * The values of this type MUST MATCH enum values in WorkspaceFeatureFlag from ws-manager/client/core_pb.d.ts
 * If they don't we'll break things during workspace startup.
 */
export const WorkspaceFeatureFlags = { "full_workspace_backup": undefined, "fixed_resources": undefined };
export type NamedWorkspaceFeatureFlag = keyof (typeof WorkspaceFeatureFlags);

export interface UserEnvVarValue {
    id?: string;
    name: string;
    repositoryPattern: string;
    value: string;
}
export interface UserEnvVar extends UserEnvVarValue {
    id: string;
    userId: string;
    deleted?: boolean;
}

export namespace UserEnvVar {

    export function normalizeRepoPattern(pattern: string) {
        return pattern.toLocaleLowerCase();
    }

    export function score(value: UserEnvVarValue): number {
        // We use a score to enforce precedence:
        //      value/value = 0
        //      value/*     = 1
        //      */value     = 2
        //      */*         = 3
        //      #/#         = 4 (used for env vars passed through the URL)
        // the lower the score, the higher the precedence.
        const [ownerPattern, repoPattern] = splitRepositoryPattern(value.repositoryPattern);
        let score = 0;
        if (repoPattern == "*") {
            score += 1;
        }
        if (ownerPattern == '*') {
            score += 2;
        }
        if (ownerPattern == "#" || repoPattern == "#") {
            score = 4;
        }
        return score;
    }

    export function filter<T extends UserEnvVarValue>(vars: T[], owner: string, repo: string): T[] {
        let result = vars.filter(e => {
            const [ownerPattern, repoPattern] = splitRepositoryPattern(e.repositoryPattern);
            if (ownerPattern !== '*' && ownerPattern !== '#' && (!!owner && ownerPattern !== owner.toLocaleLowerCase())) {
                return false;
            }
            if (repoPattern !== '*' && repoPattern !== '#' && (!!repo && repoPattern !== repo.toLocaleLowerCase())) {
                return false;
            }
            return true;
        });

        const resmap = new Map<string, T[]>();
        result.forEach(e => {
            const l = (resmap.get(e.name) || []);
            l.push(e);
            resmap.set(e.name, l);
        });

        result = [];
        for (const name of resmap.keys()) {
            const candidates = resmap.get(name);
            if (!candidates) {
                // not sure how this can happen, but so be it
                continue;
            }

            if (candidates.length == 1) {
                result.push(candidates[0]);
                continue;
            }

            let minscore = 10;
            let bestCandidate: T | undefined;
            for (const e of candidates) {
                const score = UserEnvVar.score(e);
                if (!bestCandidate || score < minscore) {
                    minscore = score;
                    bestCandidate = e;
                }
            }
            result.push(bestCandidate!);
        }

        return result;
    }

    export function splitRepositoryPattern(repositoryPattern: string): string[] {
        const patterns = repositoryPattern.split('/');
        const repoPattern = patterns.pop() || "";
        const ownerPattern = patterns.join('/');
        return [ownerPattern, repoPattern];
    }
}

export interface GitpodToken {

    /** Hash value (SHA256) of the token (primary key). */
    tokenHash: string

    /** Human readable name of the token */
    name?: string

    /** Token kind */
    type: GitpodTokenType

    /** The user the token belongs to. */
    user: User

    /** Scopes (e.g. limition to read-only) */
    scopes: string[]

    /** Created timestamp */
    created: string

    // token is deleted on the database and about to be collected by db-sync
    deleted?: boolean
}

export enum GitpodTokenType {
    API_AUTH_TOKEN = 0,
    MACHINE_AUTH_TOKEN = 1
}

export interface OneTimeSecret {
    id: string

    value: string

    expirationTime: string;

    deleted: boolean;
}

export interface WorkspaceInstanceUser {
    name?: string;
    avatarUrl?: string;
    instanceId: string;
    userId: string;
    lastSeen: string;
}

export interface Identity {
    authProviderId: string;
    authId: string;
    authName: string;
    primaryEmail?: string;
    /** @deprecated */
    tokens?: Token[];
    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
    // readonly identities cannot be modified by the user
    readonly?: boolean;
}

export type IdentityLookup = Pick<Identity, "authProviderId" | "authId">;

export namespace Identity {
    export function is(data: any): data is Identity {
        return data.hasOwnProperty('authProviderId')
            && data.hasOwnProperty('authId')
            && data.hasOwnProperty('authName')
    }
    export function equals(id1: IdentityLookup, id2: IdentityLookup) {
        return id1.authProviderId === id2.authProviderId
            && id1.authId === id2.authId
    }
}

export interface Token {
    value: string;
    scopes: string[];
    updateDate?: string;
    expiryDate?: string;
    idToken?: string;
    refreshToken?: string;
    username?: string;
}
export interface TokenEntry {
    uid: string;
    authProviderId: string;
    authId: string;
    token: Token;
    expiryDate?: string;
    refreshable?: boolean;
    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
}

export interface EmailDomainFilterEntry {
    domain: string;
    negative: boolean;
}

export interface EduEmailDomain {
    domain: string;
}

export type AppInstallationPlatform = "github";
export type AppInstallationState = "claimed.user" | "claimed.platform" | "installed" | "uninstalled";
export interface AppInstallation {
    platform: AppInstallationPlatform;
    installationID: string;
    ownerUserID?: string;
    platformUserID?: string;
    state: AppInstallationState;
    creationTime: string;
    lastUpdateTime: string;
}

export interface PendingGithubEvent {
    id: string;
    githubUserId: string;
    creationDate: Date;
    type: string;
    event: string;
}

export interface Snapshot {
    id: string;
    creationTime: string;
    originalWorkspaceId: string;
    bucketId: string;
    layoutData?: string;
}

export interface LayoutData {
    workspaceId: string;
    lastUpdatedTime: string;
    layoutData: string;
}

export interface Workspace {
    id: string;
    creationTime: string;
    contextURL: string;
    description: string;
    ownerId: string;
    projectId?: string;
    context: WorkspaceContext;
    config: WorkspaceConfig;

    /**
     * The source where to get the workspace base image from. This source is resolved
     * during workspace creation. Once a base image has been built the information in here
     * is superseded by baseImageNameResolved.
     */
    imageSource?: WorkspaceImageSource;

    /**
     * The resolved, fix name of the workspace image. We only use this
     * to access the logs during an image build.
     */
    imageNameResolved?: string

    /**
     * The resolved/built fixed named of the base image. This field is only set if the workspace
     * already has its base image built.
     */
    baseImageNameResolved?: string

    shareable?: boolean;
    pinned?: boolean;

    // workspace is hard-deleted on the database and about to be collected by db-sync
    readonly deleted?: boolean;

    /**
     * Mark as deleted (user-facing). The actual deletion of the workspace content is executed
     * with a (configurable) delay
     */
    softDeleted?: WorkspaceSoftDeletion;

    /**
     * Marks the time when the workspace was marked as softDeleted. The actual deletion of the
     * workspace content happens after a configurable period
     */
    softDeletedTime?: string;

    /**
     * Marks the time when the workspace content has been deleted.
     */
    contentDeletedTime?: string;

    type: WorkspaceType;

    basedOnPrebuildId?: string;

    basedOnSnapshotId?: string;
}

export type WorkspaceSoftDeletion = "user" | "gc";

export type WorkspaceType = "regular" | "prebuild" | "probe";

export namespace Workspace {

    export function getFullRepositoryName(ws: Workspace): string | undefined {
        if (CommitContext.is(ws.context)) {
            return ws.context.repository.owner + '/' + ws.context.repository.name
        }
        return undefined;
    }

    export function getFullRepositoryUrl(ws: Workspace): string | undefined {
        if (CommitContext.is(ws.context)) {
            return `https://${ws.context.repository.host}/${getFullRepositoryName(ws)}`
        }
        return undefined;
    }

    export function getPullRequestNumber(ws: Workspace): number | undefined {
        if (PullRequestContext.is(ws.context)) {
            return ws.context.nr;
        }
        return undefined;
    }

    export function getIssueNumber(ws: Workspace): number | undefined {
        if (IssueContext.is(ws.context)) {
            return ws.context.nr;
        }
        return undefined;
    }

    export function getBranchName(ws: Workspace): string | undefined {
        if (CommitContext.is(ws.context)) {
            return ws.context.ref;
        }
        return undefined;
    }

    export function getCommit(ws: Workspace): string | undefined {
        if (CommitContext.is(ws.context)) {
            return ws.context.revision && ws.context.revision.substr(0, 8);
        }
        return undefined;
    }
}

export interface PreparePluginUploadParams {
    fullPluginName: string;
}

export interface ResolvePluginsParams {
    config?: WorkspaceConfig
    builtins?: ResolvedPlugins
    vsxRegistryUrl?: string
}

export interface InstallPluginsParams {
    pluginIds: string[]
}

export interface UninstallPluginParams {
    pluginId: string;
}

export interface GuessGitTokenScopesParams {
    host: string
    repoUrl: string
	gitCommand: string
    currentToken: GitToken
}

export interface GitToken {
    token: string
    user: string
    scopes: string[]
}

export interface GuessedGitTokenScopes {
    message?: string
    scopes?: string[]
}

export type ResolvedPluginKind = 'user' | 'workspace' | 'builtin';

export interface ResolvedPlugins {
    [pluginId: string]: ResolvedPlugin | undefined
}

export interface ResolvedPlugin {
    fullPluginName: string;
    url: string;
    kind: ResolvedPluginKind;
}

export interface VSCodeConfig {
    extensions?: string[];
}

export interface WorkspaceConfig {
    image?: ImageConfig;
    ports?: PortConfig[];
    tasks?: TaskConfig[];
    checkoutLocation?: string;
    workspaceLocation?: string;
    gitConfig?: { [config: string]: string };
    github?: GithubAppConfig;
    vscode?: VSCodeConfig;

    /**
     * Where the config object originates from.
     *
     * repo - from the repository
     * project-db - from the "Project" stored in the database
     * definitly-gp - from github.com/gitpod-io/definitely-gp
     * derived - computed based on analyzing the repository
     * additional-content - config comes from additional content, usually provided through the project's configuration
     * default - our static catch-all default config
     */
    _origin?: 'repo' | 'project-db' | 'definitely-gp' | 'derived' | 'additional-content' | 'default';

    /**
     * Set of automatically infered feature flags. That's not something the user can set, but
     * that is set by gitpod at workspace creation time.
     */
    _featureFlags?: NamedWorkspaceFeatureFlag[];
}

export interface GithubAppConfig {
    prebuilds?: GithubAppPrebuildConfig
}
export interface GithubAppPrebuildConfig {
    master?: boolean
    branches?: boolean
    pullRequests?: boolean
    pullRequestsFromForks?: boolean
    addCheck?: boolean
    addBadge?: boolean
    addLabel?: boolean | string
    addComment?: boolean
}
export namespace GithubAppPrebuildConfig {
    export function is(obj: boolean | GithubAppPrebuildConfig): obj is GithubAppPrebuildConfig {
        return !(typeof obj === 'boolean');
    }
}

export type WorkspaceImageSource = WorkspaceImageSourceDocker | WorkspaceImageSourceReference;
export interface WorkspaceImageSourceDocker {
    dockerFilePath: string
    dockerFileHash: string
    dockerFileSource?: Commit
}
export namespace WorkspaceImageSourceDocker {
    export function is(obj: object): obj is WorkspaceImageSourceDocker {
        return 'dockerFileHash' in obj
            && 'dockerFilePath' in obj;
    }
}
export interface WorkspaceImageSourceReference {
    /** The resolved, fix base image reference */
    baseImageResolved: string;
}
export namespace WorkspaceImageSourceReference {
    export function is(obj: object): obj is WorkspaceImageSourceReference {
        return 'baseImageResolved' in obj;
    }
}

export type PrebuiltWorkspaceState
    // the prebuild is queued and may start at anytime
    = "queued"
    // the workspace prebuild is currently running (i.e. there's a workspace pod deployed)
    | "building"
    // the prebuild failed due to some issue with the system (e.g. missed a message, could not start workspace)
    | "aborted"
    // the prebuild timed out
    | "timeout"
    // the prebuild has finished and a snapshot is available
    | "available";

export interface PrebuiltWorkspace {
    id: string;
    cloneURL: string;
    branch?: string;
    projectId?: string;
    commit: string;
    buildWorkspaceId: string;
    creationTime: string;
    state: PrebuiltWorkspaceState;
    error?: string;
    snapshot?: string;
}

export namespace PrebuiltWorkspace {
    export function isDone(pws: PrebuiltWorkspace) {
        return pws.state === "available" || pws.state === "timeout" || pws.state === 'aborted';
    }

    export function isAvailable(pws: PrebuiltWorkspace) {
        return pws.state === "available" && !!pws.snapshot;
    }

    export function buildDidSucceed(pws: PrebuiltWorkspace) {
        return pws.state === "available" && !pws.error;
    }
}

export interface PrebuiltWorkspaceUpdatable {
    id: string;
    prebuiltWorkspaceId: string;
    owner: string;
    repo: string;
    isResolved: boolean;
    installationId: string;
    issue?: string;
    contextUrl?: string;
}

export interface WhitelistedRepository {
    url: string
    name: string
    description?: string
    avatar?: string
}

export type PortOnOpen = 'open-browser' | 'open-preview' | 'notify' | 'ignore';

export interface PortConfig {
    port: number;
    onOpen?: PortOnOpen;
    visibility?: PortVisibility;
}
export namespace PortConfig {
    export function is(config: any): config is PortConfig {
        return config && ('port' in config) && (typeof config.port === 'number');
    }
}

export interface PortRangeConfig {
    port: string;
    onOpen?: PortOnOpen;
}
export namespace PortRangeConfig {
    export function is(config: any): config is PortRangeConfig {
        return config && ('port' in config) && (typeof config.port === 'string' || config.port instanceof String);
    }
}

export interface TaskConfig {
    name?: string;
    before?: string;
    init?: string;
    prebuild?: string;
    command?: string;
    env?: { [env: string]: any };
    openIn?: 'bottom' | 'main' | 'left' | 'right';
    openMode?: 'split-top' | 'split-left' | 'split-right' | 'split-bottom' | 'tab-before' | 'tab-after';
}

export namespace TaskConfig {
    export function is(config: any): config is TaskConfig {
        return config
            && ('command' in config || 'init' in config || 'before' in config);
    }
}

export namespace WorkspaceImageBuild {
    export type Phase = 'BaseImage' | 'GitpodLayer' | 'Error' | 'Done';
    export interface StateInfo {
        phase: Phase
        currentStep?: number
        maxSteps?: number
    }
    export interface LogContent {
        text: string
        upToLine?: number
        isDiff?: boolean
    }
    export type LogCallback = (info: StateInfo, content: LogContent | undefined) => void;
    export namespace LogLine {
        export const DELIMITER = '\r\n';
        export const DELIMITER_REGEX = /\r?\n/;
    }
}

export type ImageConfig = ImageConfigString | ImageConfigFile;
export type ImageConfigString = string;
export namespace ImageConfigString {
    export function is(config: ImageConfig | undefined): config is ImageConfigString {
        return typeof config === 'string';
    }

}
export interface ImageConfigFile {
    // Path to the Dockerfile relative to repository root
    file: string,
    // Path to the docker build context relative to repository root
    context?: string
}
export namespace ImageConfigFile {
    export function is(config: ImageConfig | undefined): config is ImageConfigFile {
        return typeof config === 'object'
            && 'file' in config;
    }
}
export interface ExternalImageConfigFile extends ImageConfigFile {
    externalSource: Commit;
}
export namespace ExternalImageConfigFile {
    export function is(config: any | undefined): config is ExternalImageConfigFile {
        return typeof config === 'object'
            && 'file' in config
            && 'externalSource' in config;
    }
}

export interface WorkspaceContext {
    title: string;
    normalizedContextURL?: string;
    forceCreateNewWorkspace?: boolean;
    forceImageBuild?: boolean;
}

export namespace WorkspaceContext {
    export function is(context: any): context is WorkspaceContext {
        return context
            && 'title' in context;
    }
}

export interface WithSnapshot {
    snapshotBucketId: string;
}
export namespace WithSnapshot {
    export function is(context: any): context is WithSnapshot {
        return context
            && 'snapshotBucketId' in context;
    }
}

export interface WithPrebuild {
    snapshotBucketId: string;
    prebuildWorkspaceId: string;
    wasPrebuilt: true;
}
export namespace WithPrebuild {
    export function is(context: any): context is WithPrebuild {
        return context
            && 'snapshotBucketId' in context
            && 'prebuildWorkspaceId' in context
            && 'wasPrebuilt' in context;
    }
}

/**
 * WithDefaultConfig contexts disable the download of the gitpod.yml from the repository
 * and fall back to the built-in configuration.
 */
export interface WithDefaultConfig {
    withDefaultConfig: true;
}

export namespace WithDefaultConfig {
    export function is(context: any): context is WithDefaultConfig {
        return context
            && 'withDefaultConfig' in context
            && context.withDefaultConfig;
    }

    export function mark(ctx: WorkspaceContext): WorkspaceContext & WithDefaultConfig {
        return {
            ...ctx,
            withDefaultConfig: true
        }
    }
}

export interface SnapshotContext extends WorkspaceContext, WithSnapshot {
    snapshotId: string;
}

export namespace SnapshotContext {
    export function is(context: any): context is SnapshotContext {
        return context
            && WithSnapshot.is(context)
            && 'snapshotId' in context;
    }
}

export interface StartPrebuildContext extends WorkspaceContext {
    actual: WorkspaceContext;
    commitHistory?: string[];
    project?: Project;
    branch?: string;
}

export namespace StartPrebuildContext {
    export function is(context: any): context is StartPrebuildContext {
        return context
            && 'actual' in context;
    }
}

export interface PrebuiltWorkspaceContext extends WorkspaceContext {
    originalContext: WorkspaceContext;
    prebuiltWorkspace: PrebuiltWorkspace;
    snapshotBucketId?: string;
}

export namespace PrebuiltWorkspaceContext {
    export function is(context: any): context is PrebuiltWorkspaceContext {
        return context
            && 'originalContext' in context
            && 'prebuiltWorkspace' in context;
    }
}

export interface WithEnvvarsContext extends WorkspaceContext {
    envvars: UserEnvVarValue[];
}

export namespace WithEnvvarsContext {
    export function is(context: any): context is WithEnvvarsContext {
        return context
            && 'envvars' in context
    }
}

export interface WorkspaceProbeContext extends WorkspaceContext {
    responseURL: string
    responseToken: string
}

export namespace WorkspaceProbeContext {
    export function is(context: any): context is WorkspaceProbeContext {
        return context
            && 'responseURL' in context
            && 'responseToken' in context;
    }
}

export type RefType = "branch" | "tag" | "revision";
export namespace RefType {
    export const getRefType = (commit: Commit): RefType => {
        if (!commit.ref) {
            return "revision";
        }
        // This fallback is meant to handle the cases where (for historic reasons) ref is present but refType is missing
        return commit.refType || "branch";
    }
}

export interface Commit {
    repository: Repository
    revision: string

    // Might contain either a branch or a tag (determined by refType)
    ref?: string

    // refType is only set if ref is present (and not for old workspaces, before this feature was added)
    refType?: RefType
}

export interface AdditionalContentContext extends WorkspaceContext {

    /**
     * utf-8 encoded contents that will be copied on top of the workspace's filesystem
     */
    additionalFiles: {[filePath: string]: string};

}

export namespace AdditionalContentContext {
    export function is(ctx: any): ctx is AdditionalContentContext {
        return 'additionalFiles' in ctx;
    }

    export function hasDockerConfig(ctx: any, config: WorkspaceConfig): boolean {
        return is(ctx) && ImageConfigFile.is(config.image) && !!ctx.additionalFiles[config.image.file];
    }
}

export interface CommitContext extends WorkspaceContext, Commit {
    /** @deprecated Moved to .repository.cloneUrl, left here for backwards-compatibility for old workspace contextes in the DB */
    cloneUrl?: string
}

export namespace CommitContext {
    export function is(commit: any): commit is CommitContext {
        return WorkspaceContext.is(commit)
            && 'repository' in commit
            && 'revision' in commit
    }
}

export interface PullRequestContext extends CommitContext {
    nr: number;
    ref: string;
    base: {
        repository: Repository
        ref: string
    }
}

export namespace PullRequestContext {
    export function is(ctx: any): ctx is PullRequestContext {
        return CommitContext.is(ctx)
            && 'nr' in ctx
            && 'ref' in ctx
            && 'base' in ctx
    }
}

export interface IssueContext extends CommitContext {
    nr: number;
    ref: string;
    localBranch: string;
}

export namespace IssueContext {
    export function is(ctx: any): ctx is IssueContext {
        return CommitContext.is(ctx)
            && 'nr' in ctx
            && 'ref' in ctx
            && 'localBranch' in ctx
    }
}

export interface NavigatorContext extends CommitContext {
    path: string;
    isFile: boolean;
}

export namespace NavigatorContext {
    export function is(ctx: any): ctx is NavigatorContext {
        return CommitContext.is(ctx)
            && 'path' in ctx
            && 'isFile' in ctx
    }
}

export interface Repository {
    host: string;
    owner: string;
    name: string;
    cloneUrl: string;
    description?: string;
    avatarUrl?: string;
    webUrl?: string;
    defaultBranch?: string;
    /** Optional for backwards compatibility */
    private?: boolean;
    fork?: {
        // The direct parent of this fork
        parent: Repository
    }
}
export interface Branch {
    name: string;
    commit: CommitInfo;
    htmlUrl: string;
}

export interface CommitInfo {
    author: string;
    sha: string;
    commitMessage: string;
    authorAvatarUrl?: string;
    authorDate?: string;
}

export namespace Repository {
    export function fullRepoName(repo: Repository): string {
        return `${repo.host}/${repo.owner}/${repo.name}`;
    }
}

export interface WorkspaceInstancePortsChangedEvent {
    type: "PortsChanged";
    instanceID: string;
    portsOpened: number[]
    portsClosed: number[]
}

export namespace WorkspaceInstancePortsChangedEvent {

    export function is(data: any): data is WorkspaceInstancePortsChangedEvent {
        return data && data.type == "PortsChanged";
    }

}

export interface WorkspaceInfo {
    workspace: Workspace
    latestInstance?: WorkspaceInstance
}

export namespace WorkspaceInfo {
    export function lastActiveISODate(info: WorkspaceInfo): string {
        return info.latestInstance?.creationTime || info.workspace.creationTime;
    }
}

export type RunningWorkspaceInfo = WorkspaceInfo & { latestInstance: WorkspaceInstance };

export interface WorkspaceCreationResult {
    createdWorkspaceId?: string;
    workspaceURL?: string;
    existingWorkspaces?: WorkspaceInfo[];
    runningWorkspacePrebuild?: {
        prebuildID: string
        workspaceID: string
        instanceID: string
        starting: RunningWorkspacePrebuildStarting
        sameCluster: boolean
    }
    runningPrebuildWorkspaceID?: string;
}
export type RunningWorkspacePrebuildStarting = 'queued' | 'starting' | 'running';

export enum CreateWorkspaceMode {
    // Default returns a running prebuild if there is any, otherwise creates a new workspace (using a prebuild if one is available)
    Default = 'default',
    // ForceNew creates a new workspace irrespective of any running prebuilds. This mode is guaranteed to actually create a workspace - but may degrade user experience as currently runnig prebuilds are ignored.
    ForceNew = 'force-new',
    // UsePrebuild polls the database waiting for a currently running prebuild to become available. This mode exists to handle the db-sync delay.
    UsePrebuild = 'use-prebuild',
    // SelectIfRunning returns a list of currently running workspaces for the context URL if there are any, otherwise falls back to Default mode
    SelectIfRunning = 'select-if-running',
}

export namespace WorkspaceCreationResult {
    export function is(data: any): data is WorkspaceCreationResult {
        return data && (
            'createdWorkspaceId' in data
            || 'existingWorkspaces' in data
            || 'runningWorkspacePrebuild' in data
            || 'runningPrebuildWorkspaceID' in data
        )
    }
}

export interface UserMessage {
    readonly id: string;
    readonly title?: string;
    /**
     * date from where on this message should be shown
     */
    readonly from?: string;
    readonly content?: string;
    readonly url?: string;
}

export interface AuthProviderInfo {
    readonly authProviderId: string;
    readonly authProviderType: string;
    readonly host: string;
    readonly ownerId?: string;
    readonly verified: boolean;
    readonly isReadonly?: boolean;
    readonly hiddenOnDashboard?: boolean;
    readonly loginContextMatcher?: string;
    readonly disallowLogin?: boolean;
    readonly icon?: string;
    readonly description?: string;

    readonly settingsUrl?: string;
    readonly scopes?: string[];
    readonly requirements?: {
        readonly default: string[];
        readonly publicRepo: string[];
        readonly privateRepo: string[];
    }
}

export interface AuthProviderEntry {
    readonly id: string;
    readonly type: AuthProviderEntry.Type;
    readonly host: string;
    readonly ownerId: string;

    readonly status: AuthProviderEntry.Status;

    readonly oauth: OAuth2Config;
}

export interface OAuth2Config {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly callBackUrl: string;
    readonly authorizationUrl: string;
    readonly tokenUrl: string;
    readonly scope?: string;
    readonly scopeSeparator?: string;

    readonly settingsUrl?: string;
    readonly authorizationParams?: { [key: string]: string }
    readonly configURL?: string;
}

export namespace AuthProviderEntry {
    export type Type = "GitHub" | "GitLab" | string;
    export type Status = "pending" | "verified";
    export type NewEntry = Pick<AuthProviderEntry, "ownerId" | "host" | "type"> & { clientId?: string, clientSecret?: string };
    export type UpdateEntry = Pick<AuthProviderEntry, "id" | "ownerId"> & Pick<OAuth2Config, "clientId" | "clientSecret">;
    export function redact(entry: AuthProviderEntry): AuthProviderEntry {
        return {
            ...entry,
            oauth: {
                ...entry.oauth,
                clientSecret: "redacted"
            }
        }
    }
}

export interface Branding {
    readonly name: string;
    readonly favicon?: string;
    /** Either including domain OR absolute path (interpreted relative to host URL) */
    readonly logo: string;
    readonly startupLogo: string;
    readonly showProductivityTips: boolean;
    readonly redirectUrlIfNotAuthenticated?: string;
    readonly redirectUrlAfterLogout?: string;
    readonly homepage: string;
    readonly ide?: {
        readonly logo: string;
        readonly showReleaseNotes: boolean;
        readonly helpMenu: Branding.Link[];
    }
    readonly links: {
        readonly header: Branding.Link[];
        readonly footer: Branding.Link[];
        readonly social: Branding.SocialLink[];
        readonly legal: Branding.Link[];
    }
}
export namespace Branding {
    export interface Link {
        readonly name: string;
        readonly url: string;
    }
    export interface SocialLink {
        readonly type: string;
        readonly url: string;
    }
}

export interface Configuration {
    readonly daysBeforeGarbageCollection: number;
    readonly garbageCollectionStartDate: number;
}

export interface TheiaPlugin {
    id: string;
    pluginName: string;
    pluginId?: string;
    /**
     * Id of the user which uploaded this plugin.
     */
    userId?: string;
    bucketName: string;
    path: string;
    hash?: string;
    state: TheiaPlugin.State;
}
export namespace TheiaPlugin {
    export enum State {
        Uploading = "uploading",
        Uploaded = "uploaded",
        CheckinFailed = "checkin-failed",
    }
}

export interface TermsAcceptanceEntry {
    readonly userId: string;
    readonly termsRevision: string;
    readonly acceptionTime: string;
}

export interface Terms {
    readonly revision: string;
    readonly activeSince: string;
    readonly adminOnlyTerms: boolean;
    readonly updateMessage: string;
    readonly content: string;
    readonly formElements?: object;
}

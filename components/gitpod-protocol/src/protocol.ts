/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceInstance, PortVisibility, PortProtocol } from "./workspace-instance";
import { RoleOrPermission } from "./permission";
import { Project } from "./teams-projects-protocol";
import { createHash } from "crypto";
import { WorkspaceRegion } from "./workspace-cluster";

export interface UserInfo {
    name?: string;
}

export interface User {
    /** The user id */
    id: string;

    /** The ID of the Organization this user is owned by. If undefined, the user is owned by the installation */
    organizationId?: string;

    /** The timestamp when the user entry was created */
    creationDate: string;

    avatarUrl?: string;

    name?: string;

    /** Optional for backwards compatibility */
    fullName?: string;

    identities: Identity[];

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

    // Identifies an explicit team or user ID to which all the user's workspace usage should be attributed to (e.g. for billing purposes)
    usageAttributionId?: string;

    // The last time this user got verified somehow. The user is not verified if this is empty.
    lastVerificationTime?: string;

    // The phone number used for the last phone verification.
    verificationPhoneNumber?: string;
}

export namespace User {
    export function is(data: any): data is User {
        return data && data.hasOwnProperty("id") && data.hasOwnProperty("identities");
    }
    export function getIdentity(user: User, authProviderId: string): Identity | undefined {
        return user.identities.find((id) => id.authProviderId === authProviderId);
    }

    /**
     * Returns a primary email address of a user.
     *
     * For accounts owned by an organization, it returns the email of the most recently used SSO identity.
     *
     * For personal accounts, first it looks for a email stored by the user, and falls back to any of the Git provider identities.
     *
     * @param user
     * @returns A primaryEmail, or undefined.
     */
    export function getPrimaryEmail(user: User): string | undefined {
        // If the accounts is owned by an organization, use the email of the most recently
        // used SSO identity.
        if (User.isOrganizationOwned(user)) {
            const compareTime = (a?: string, b?: string) => (a || "").localeCompare(b || "");
            const recentlyUsedSSOIdentity = user.identities
                .sort((a, b) => compareTime(a.lastSigninTime, b.lastSigninTime))
                // optimistically pick the most recent one
                .reverse()[0];
            return recentlyUsedSSOIdentity?.primaryEmail;
        }

        // In case of a personal account, check for the email stored by the user.
        if (!isOrganizationOwned(user) && user.additionalData?.profile?.emailAddress) {
            return user.additionalData?.profile?.emailAddress;
        }

        // Otherwise pick any
        // FIXME(at) this is still not correct, as it doesn't distinguish between
        // sign-in providers and additional Git hosters.
        const identities = user.identities.filter((i) => !!i.primaryEmail);
        if (identities.length <= 0) {
            return undefined;
        }

        return identities[0].primaryEmail || undefined;
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

    export function hasPreferredIde(user: User) {
        return (
            typeof user?.additionalData?.ideSettings?.defaultIde !== "undefined" ||
            typeof user?.additionalData?.ideSettings?.useLatestVersion !== "undefined"
        );
    }

    export function isOnboardingUser(user: User) {
        if (isOrganizationOwned(user)) {
            return false;
        }
        // If a user has already been onboarded
        // Also, used to rule out "admin-user"
        if (!!user.additionalData?.profile?.onboardedTimestamp) {
            return false;
        }
        return !hasPreferredIde(user);
    }

    export function isOrganizationOwned(user: User) {
        return !!user.organizationId;
    }

    export function migrationIDESettings(user: User) {
        if (
            !user?.additionalData?.ideSettings ||
            Object.keys(user.additionalData.ideSettings).length === 0 ||
            user.additionalData.ideSettings.settingVersion === "2.0"
        ) {
            return;
        }
        const newIDESettings: IDESettings = {
            settingVersion: "2.0",
        };
        const ideSettings = user.additionalData.ideSettings;
        if (ideSettings.useDesktopIde) {
            if (ideSettings.defaultDesktopIde === "code-desktop") {
                newIDESettings.defaultIde = "code-desktop";
            } else if (ideSettings.defaultDesktopIde === "code-desktop-insiders") {
                newIDESettings.defaultIde = "code-desktop";
                newIDESettings.useLatestVersion = true;
            } else {
                newIDESettings.defaultIde = ideSettings.defaultDesktopIde;
                newIDESettings.useLatestVersion = ideSettings.useLatestVersion;
            }
        } else {
            const useLatest = ideSettings.defaultIde === "code-latest";
            newIDESettings.defaultIde = "code";
            newIDESettings.useLatestVersion = useLatest;
        }
        user.additionalData.ideSettings = newIDESettings;
    }

    // TODO: make it more explicit that these field names are relied for our tracking purposes
    // and decouple frontend from relying on them - instead use user.additionalData.profile object directly in FE
    export function getProfile(user: User): Profile {
        return {
            name: User.getName(user!) || "",
            email: User.getPrimaryEmail(user!) || "",
            company: user?.additionalData?.profile?.companyName,
            avatarURL: user?.avatarUrl,
            jobRole: user?.additionalData?.profile?.jobRole,
            jobRoleOther: user?.additionalData?.profile?.jobRoleOther,
            explorationReasons: user?.additionalData?.profile?.explorationReasons,
            signupGoals: user?.additionalData?.profile?.signupGoals,
            signupGoalsOther: user?.additionalData?.profile?.signupGoalsOther,
            companySize: user?.additionalData?.profile?.companySize,
            onboardedTimestamp: user?.additionalData?.profile?.onboardedTimestamp,
        };
    }

    export function setProfile(user: User, profile: Profile): User {
        user.fullName = profile.name;
        user.avatarUrl = profile.avatarURL;

        if (!user.additionalData) {
            user.additionalData = {};
        }
        if (!user.additionalData.profile) {
            user.additionalData.profile = {};
        }
        user.additionalData.profile.emailAddress = profile.email;
        user.additionalData.profile.companyName = profile.company;
        user.additionalData.profile.lastUpdatedDetailsNudge = new Date().toISOString();

        return user;
    }

    // TODO: refactor where this is referenced so it's more clearly tied to just analytics-tracking
    // Let other places rely on the ProfileDetails type since that's what we store
    // This is the profile data we send to our Segment analytics tracking pipeline
    export interface Profile {
        name: string;
        email: string;
        company?: string;
        avatarURL?: string;
        jobRole?: string;
        jobRoleOther?: string;
        explorationReasons?: string[];
        signupGoals?: string[];
        signupGoalsOther?: string;
        onboardedTimestamp?: string;
        companySize?: string;
    }
    export namespace Profile {
        export function hasChanges(before: Profile, after: Profile) {
            return (
                before.name !== after.name ||
                before.email !== after.email ||
                before.company !== after.company ||
                before.avatarURL !== after.avatarURL ||
                before.jobRole !== after.jobRole ||
                before.jobRoleOther !== after.jobRoleOther ||
                // not checking explorationReasons or signupGoals atm as it's an array - need to check deep equality
                before.signupGoalsOther !== after.signupGoalsOther ||
                before.onboardedTimestamp !== after.onboardedTimestamp ||
                before.companySize !== after.companySize
            );
        }
    }
}

export interface WorkspaceTimeoutSetting {
    // user globol workspace timeout
    workspaceTimeout: string;
    // control whether to enable the closed timeout of a workspace, i.e. close web ide, disconnect ssh connection
    disabledClosedTimeout: boolean;
}

export interface AdditionalUserData extends Partial<WorkspaceTimeoutSetting> {
    platforms?: UserPlatform[];
    emailNotificationSettings?: EmailNotificationSettings;
    featurePreview?: boolean;
    ideSettings?: IDESettings;
    // key is the name of the news, string the iso date when it was seen
    whatsNewSeen?: { [key: string]: string };
    // key is the name of the OAuth client i.e. local app, string the iso date when it was approved
    // TODO(rl): provide a management UX to allow rescinding of approval
    oauthClientsApproved?: { [key: string]: string };
    // to remember GH Orgs the user installed/updated the GH App for
    knownGitHubOrgs?: string[];
    // Git clone URL pointing to the user's dotfile repo
    dotfileRepo?: string;
    // preferred workspace classes
    workspaceClasses?: WorkspaceClasses;
    // additional user profile data
    profile?: ProfileDetails;
    shouldSeeMigrationMessage?: boolean;
    // fgaRelationshipsVersion is the version of the spicedb relationships
    fgaRelationshipsVersion?: number;
    // remembered workspace auto start options
    workspaceAutostartOptions?: WorkspaceAutostartOption[];
}

interface WorkspaceAutostartOption {
    cloneURL: string;
    organizationId: string;
    workspaceClass?: string;
    ideSettings?: IDESettings;
    region?: WorkspaceRegion;
}

export namespace AdditionalUserData {
    export function set(user: User, partialData: Partial<AdditionalUserData>): User {
        if (!user.additionalData) {
            user.additionalData = {
                ...partialData,
            };
        } else {
            user.additionalData = {
                ...user.additionalData,
                ...partialData,
            };
        }
        return user;
    }
}
// The format in which we store User Profiles in
export interface ProfileDetails {
    // when was the last time the user updated their profile information or has been nudged to do so.
    lastUpdatedDetailsNudge?: string;
    // the user's company name
    companyName?: string;
    // the user's email
    emailAddress?: string;
    // type of role user has in their job
    jobRole?: string;
    // freeform entry for job role user works in (when jobRole is "other")
    jobRoleOther?: string;
    // Reasons user is exploring Gitpod when they signed up
    explorationReasons?: string[];
    // what user hopes to accomplish when they signed up
    signupGoals?: string[];
    // freeform entry for signup goals (when signupGoals is "other")
    signupGoalsOther?: string;
    // Set after a user completes the onboarding flow
    onboardedTimestamp?: string;
    // Onboarding question about a user's company size
    companySize?: string;
}

export interface EmailNotificationSettings {
    allowsChangelogMail?: boolean;
    allowsDevXMail?: boolean;
    allowsOnboardingMail?: boolean;
}

export type IDESettings = {
    settingVersion?: string;
    defaultIde?: string;
    useLatestVersion?: boolean;
    // DEPRECATED: Use defaultIde after `settingVersion: 2.0`, no more specialify desktop or browser.
    useDesktopIde?: boolean;
    // DEPRECATED: Same with useDesktopIde.
    defaultDesktopIde?: string;
};

export interface WorkspaceClasses {
    regular?: string;
    prebuild?: string;
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
     * Permanent feature flags are added to each and every workspace instance
     * this user starts.
     */
    permanentWSFeatureFlags?: NamedWorkspaceFeatureFlag[];
}

export type BillingTier = "paid" | "free";

/**
 * The values of this type MUST MATCH enum values in WorkspaceFeatureFlag from ws-manager/client/core_pb.d.ts
 * If they don't we'll break things during workspace startup.
 */
export const WorkspaceFeatureFlags = {
    full_workspace_backup: undefined,
    workspace_class_limiting: undefined,
    workspace_connection_limiting: undefined,
    workspace_psi: undefined,
};
export type NamedWorkspaceFeatureFlag = keyof typeof WorkspaceFeatureFlags;
export namespace NamedWorkspaceFeatureFlag {
    export const WORKSPACE_PERSISTED_FEATTURE_FLAGS: NamedWorkspaceFeatureFlag[] = ["full_workspace_backup"];
    export function isWorkspacePersisted(ff: NamedWorkspaceFeatureFlag): boolean {
        return WORKSPACE_PERSISTED_FEATTURE_FLAGS.includes(ff);
    }
}

export type EnvVar = UserEnvVar | ProjectEnvVarWithValue | EnvVarWithValue;

export interface EnvVarWithValue {
    name: string;
    value: string;
}

export interface ProjectEnvVarWithValue extends EnvVarWithValue {
    id: string;
    projectId: string;
    censored: boolean;
}

export type ProjectEnvVar = Omit<ProjectEnvVarWithValue, "value">;

export interface UserEnvVarValue extends EnvVarWithValue {
    id?: string;
    repositoryPattern: string; // DEPRECATED: Use ProjectEnvVar instead of repositoryPattern - https://github.com/gitpod-com/gitpod/issues/5322
}
export interface UserEnvVar extends UserEnvVarValue {
    id: string;
    userId: string;
    deleted?: boolean;
}

export namespace UserEnvVar {
    export const DELIMITER = "/";
    export const WILDCARD_ASTERISK = "*";
    // This wildcard is only allowed on the last segment, and matches arbitrary segments to the right
    export const WILDCARD_DOUBLE_ASTERISK = "**";
    const WILDCARD_SHARP = "#"; // TODO(gpl) Where does this come from? Bc we have/had patterns as part of URLs somewhere, maybe...?
    const MIN_PATTERN_SEGMENTS = 2;

    function isWildcard(c: string): boolean {
        return c === WILDCARD_ASTERISK || c === WILDCARD_SHARP;
    }

    /**
     * @param variable
     * @returns Either a string containing an error message or undefined.
     */
    export function validate(variable: UserEnvVarValue): string | undefined {
        const name = variable.name;
        const pattern = variable.repositoryPattern;
        if (name.trim() === "") {
            return "Name must not be empty.";
        }
        if (name.length > 255) {
            return "Name too long. Maximum name length is 255 characters.";
        }
        if (!/^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(name)) {
            return "Name must match /^[a-zA-Z_]+[a-zA-Z0-9_]*$/.";
        }
        if (variable.value.trim() === "") {
            return "Value must not be empty.";
        }
        if (variable.value.length > 32767) {
            return "Value too long. Maximum value length is 32767 characters.";
        }
        if (pattern.trim() === "") {
            return "Scope must not be empty.";
        }
        const split = splitRepositoryPattern(pattern);
        if (split.length < MIN_PATTERN_SEGMENTS) {
            return "A scope must use the form 'organization/repo'.";
        }
        for (const name of split) {
            if (name !== "*") {
                if (!/^[a-zA-Z0-9_\-.\*]+$/.test(name)) {
                    return "Invalid scope segment. Only ASCII characters, numbers, -, _, . or * are allowed.";
                }
            }
        }
        return undefined;
    }

    export function normalizeRepoPattern(pattern: string) {
        return pattern.toLocaleLowerCase();
    }

    function splitRepositoryPattern(pattern: string): string[] {
        return pattern.split(DELIMITER);
    }

    function joinRepositoryPattern(...parts: string[]): string {
        return parts.join(DELIMITER);
    }

    /**
     * Matches the given EnvVar pattern against the fully qualified name of the repository:
     *  - GitHub: "repo/owner"
     *  - GitLab: "some/nested/repo" (up to MAX_PATTERN_SEGMENTS deep)
     * @param pattern
     * @param repoFqn
     * @returns True if the pattern matches that fully qualified name
     */
    export function matchEnvVarPattern(pattern: string, repoFqn: string): boolean {
        const fqnSegments = splitRepositoryPattern(repoFqn);
        const patternSegments = splitRepositoryPattern(pattern);
        if (patternSegments.length < MIN_PATTERN_SEGMENTS) {
            // Technically not a problem, but we should not allow this for safety reasons.
            // And because we hisotrically never allowed this (GitHub would always require at least "*/*") we are just keeping old constraints.
            // Note: Most importantly this guards against arbitrary wildcard matches
            return false;
        }

        function isWildcardMatch(patternSegment: string, isLastSegment: boolean): boolean {
            if (isWildcard(patternSegment)) {
                return true;
            }
            return isLastSegment && patternSegment === WILDCARD_DOUBLE_ASTERISK;
        }
        let i = 0;
        for (; i < patternSegments.length; i++) {
            if (i >= fqnSegments.length) {
                return false;
            }
            const fqnSegment = fqnSegments[i];
            const patternSegment = patternSegments[i];
            const isLastSegment = patternSegments.length === i + 1;
            if (!isWildcardMatch(patternSegment, isLastSegment) && patternSegment !== fqnSegment.toLocaleLowerCase()) {
                return false;
            }
        }
        if (fqnSegments.length > i) {
            // Special case: "**" as last segment matches arbitrary # of segments to the right
            if (patternSegments[i - 1] === WILDCARD_DOUBLE_ASTERISK) {
                return true;
            }
            return false;
        }
        return true;
    }

    // Matches the following patterns for "some/nested/repo", ordered by highest score:
    //  - exact: some/nested/repo ()
    //  - partial:
    //    - some/nested/*
    //    - some/*
    //  - generic:
    //    - */*/*
    //    - */*
    // Does NOT match:
    //  - */repo (number of parts does not match)
    // cmp. test cases in env-var-service.spec.ts
    export function filter<T extends UserEnvVarValue>(vars: T[], owner: string, repo: string): T[] {
        const matchedEnvVars = vars.filter((e) =>
            matchEnvVarPattern(e.repositoryPattern, joinRepositoryPattern(owner, repo)),
        );
        const resmap = new Map<string, T[]>();
        matchedEnvVars.forEach((e) => {
            const l = resmap.get(e.name) || [];
            l.push(e);
            resmap.set(e.name, l);
        });

        // In cases of multiple matches per env var: find the best match
        // Best match is the most specific pattern, where the left-most segment is most significant
        function scoreMatchedEnvVar(e: T): number {
            function valueSegment(segment: string): number {
                switch (segment) {
                    case WILDCARD_ASTERISK:
                        return 2;
                    case WILDCARD_SHARP:
                        return 2;
                    case WILDCARD_DOUBLE_ASTERISK:
                        return 1;
                    default:
                        return 3;
                }
            }
            const patternSegments = splitRepositoryPattern(e.repositoryPattern);
            let result = 0;
            for (const segment of patternSegments) {
                // We can assume the pattern matches from context, so we just need to check whether it's a wildcard or not
                const val = valueSegment(segment);
                result = result * 10 + val;
            }
            return result;
        }
        const result = [];
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

            let bestCandidate = candidates[0];
            let bestScore = scoreMatchedEnvVar(bestCandidate);
            for (const e of candidates.slice(1)) {
                const score = scoreMatchedEnvVar(e);
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = e;
                }
            }
            result.push(bestCandidate!);
        }

        return result;
    }
}

export interface SSHPublicKeyValue {
    name: string;
    key: string;
}
export interface UserSSHPublicKey extends SSHPublicKeyValue {
    id: string;
    key: string;
    userId: string;
    fingerprint: string;
    creationTime: string;
    lastUsedTime?: string;
}

export type UserSSHPublicKeyValue = Omit<UserSSHPublicKey, "userId">;

export namespace SSHPublicKeyValue {
    export function validate(value: SSHPublicKeyValue): string | undefined {
        if (value.name.length === 0) {
            return "Title must not be empty.";
        }
        if (value.name.length > 255) {
            return "Title too long. Maximum value length is 255 characters.";
        }
        if (value.key.length === 0) {
            return "Key must not be empty.";
        }
        try {
            getData(value);
        } catch (e) {
            return "Key is invalid. You must supply a key in OpenSSH public key format.";
        }
        return;
    }

    export function getData(value: SSHPublicKeyValue) {
        // Begins with 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519', 'sk-ecdsa-sha2-nistp256@openssh.com', or 'sk-ssh-ed25519@openssh.com'.
        const regex =
            /^(?<type>ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521|ssh-ed25519|sk-ecdsa-sha2-nistp256@openssh\.com|sk-ssh-ed25519@openssh\.com) (?<key>.*?)( (?<email>.*?))?$/;
        const resultGroup = regex.exec(value.key.trim());
        if (!resultGroup) {
            throw new Error("Key is invalid.");
        }
        return {
            type: resultGroup.groups?.["type"] as string,
            key: resultGroup.groups?.["key"] as string,
            email: resultGroup.groups?.["email"] || undefined,
        };
    }

    export function getFingerprint(value: SSHPublicKeyValue) {
        const data = getData(value);
        const buf = Buffer.from(data.key, "base64");
        // gitlab style
        // const hash = createHash("md5").update(buf).digest("hex");
        // github style
        const hash = createHash("sha256").update(buf).digest("base64");
        return hash;
    }

    export const MAXIMUM_KEY_LENGTH = 5;
}

export interface GitpodToken {
    /** Hash value (SHA256) of the token (primary key). */
    tokenHash: string;

    /** Human readable name of the token */
    name?: string;

    /** Token kind */
    type: GitpodTokenType;

    /** The user the token belongs to. */
    userId: string;

    /** Scopes (e.g. limition to read-only) */
    scopes: string[];

    /** Created timestamp */
    created: string;

    // token is deleted on the database and about to be collected by periodic deleter
    deleted?: boolean;
}

export enum GitpodTokenType {
    API_AUTH_TOKEN = 0,
    MACHINE_AUTH_TOKEN = 1,
}

export interface OneTimeSecret {
    id: string;

    value: string;

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
    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
    // The last time this entry was touched during a signin.
    lastSigninTime?: string;

    // @deprecated as no longer in use since '19
    readonly?: boolean;
}

export type IdentityLookup = Pick<Identity, "authProviderId" | "authId">;

export namespace Identity {
    export function is(data: any): data is Identity {
        return (
            data.hasOwnProperty("authProviderId") && data.hasOwnProperty("authId") && data.hasOwnProperty("authName")
        );
    }
    export function equals(id1: IdentityLookup, id2: IdentityLookup) {
        return id1.authProviderId === id2.authProviderId && id1.authId === id2.authId;
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
    deleted: boolean;
}

export interface Snapshot {
    id: string;
    creationTime: string;
    availableTime?: string;
    originalWorkspaceId: string;
    bucketId: string;
    state: SnapshotState;
    message?: string;
}

export type SnapshotState = "pending" | "available" | "error";

export interface Workspace {
    id: string;
    creationTime: string;
    organizationId: string;
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
    imageNameResolved?: string;

    /**
     * The resolved/built fixed named of the base image. This field is only set if the workspace
     * already has its base image built.
     */
    baseImageNameResolved?: string;

    shareable?: boolean;
    pinned?: boolean;

    // workspace is hard-deleted on the database and about to be collected by periodic deleter
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

export type WorkspaceType = "regular" | "prebuild";

export namespace Workspace {
    export function getFullRepositoryName(ws: Workspace): string | undefined {
        if (CommitContext.is(ws.context)) {
            return ws.context.repository.owner + "/" + ws.context.repository.name;
        }
        return undefined;
    }

    export function getFullRepositoryUrl(ws: Workspace): string | undefined {
        if (CommitContext.is(ws.context)) {
            return `https://${ws.context.repository.host}/${getFullRepositoryName(ws)}`;
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

export interface GuessGitTokenScopesParams {
    host: string;
    repoUrl: string;
    gitCommand: string;
    currentToken: GitToken;
}

export interface GitToken {
    token: string;
    user: string;
    scopes: string[];
}

export interface GuessedGitTokenScopes {
    message?: string;
    scopes?: string[];
}

export interface VSCodeConfig {
    extensions?: string[];
}

export interface JetBrainsConfig {
    intellij?: JetBrainsProductConfig;
    goland?: JetBrainsProductConfig;
    pycharm?: JetBrainsProductConfig;
    phpstorm?: JetBrainsProductConfig;
    rubymine?: JetBrainsProductConfig;
    webstorm?: JetBrainsProductConfig;
    rider?: JetBrainsProductConfig;
    clion?: JetBrainsProductConfig;
}
export interface JetBrainsProductConfig {
    prebuilds?: JetBrainsPrebuilds;
    vmoptions?: string;
}
export interface JetBrainsPrebuilds {
    version?: "stable" | "latest" | "both";
}

export interface RepositoryCloneInformation {
    url: string;
    checkoutLocation?: string;
}

export interface CoreDumpConfig {
    enabled?: boolean;
    softLimit?: number;
    hardLimit?: number;
}

export interface WorkspaceConfig {
    mainConfiguration?: string;
    additionalRepositories?: RepositoryCloneInformation[];
    image?: ImageConfig;
    ports?: PortConfig[];
    tasks?: TaskConfig[];
    checkoutLocation?: string;
    workspaceLocation?: string;
    gitConfig?: { [config: string]: string };
    github?: GithubAppConfig;
    vscode?: VSCodeConfig;
    jetbrains?: JetBrainsConfig;
    coreDump?: CoreDumpConfig;
    ideCredentials?: string;

    /** deprecated. Enabled by default **/
    experimentalNetwork?: boolean;

    /**
     * Where the config object originates from.
     *
     * repo - from the repository
     * definitly-gp - from github.com/gitpod-io/definitely-gp
     * derived - computed based on analyzing the repository
     * additional-content - config comes from additional content, usually provided through the project's configuration
     * default - our static catch-all default config
     */
    _origin?: "repo" | "definitely-gp" | "derived" | "additional-content" | "default";

    /**
     * Set of automatically infered feature flags. That's not something the user can set, but
     * that is set by gitpod at workspace creation time.
     */
    _featureFlags?: NamedWorkspaceFeatureFlag[];
}

export interface GithubAppConfig {
    prebuilds?: GithubAppPrebuildConfig;
}
export interface GithubAppPrebuildConfig {
    master?: boolean;
    branches?: boolean;
    pullRequests?: boolean;
    pullRequestsFromForks?: boolean;
    addCheck?: boolean | "prevent-merge-on-error";
    addBadge?: boolean;
    addLabel?: boolean | string;
    addComment?: boolean;
}
export namespace GithubAppPrebuildConfig {
    export function is(obj: boolean | GithubAppPrebuildConfig): obj is GithubAppPrebuildConfig {
        return !(typeof obj === "boolean");
    }
}

export type WorkspaceImageSource = WorkspaceImageSourceDocker | WorkspaceImageSourceReference;
export interface WorkspaceImageSourceDocker {
    dockerFilePath: string;
    dockerFileHash: string;
    dockerFileSource?: Commit;
}
export namespace WorkspaceImageSourceDocker {
    export function is(obj: object): obj is WorkspaceImageSourceDocker {
        return "dockerFileHash" in obj && "dockerFilePath" in obj;
    }
}
export interface WorkspaceImageSourceReference {
    /** The resolved, fix base image reference */
    baseImageResolved: string;
}
export namespace WorkspaceImageSourceReference {
    export function is(obj: object): obj is WorkspaceImageSourceReference {
        return "baseImageResolved" in obj;
    }
}

export type PrebuiltWorkspaceState =
    // the prebuild is queued and may start at anytime
    | "queued"
    // the workspace prebuild is currently running (i.e. there's a workspace pod deployed)
    | "building"
    // the prebuild was aborted
    | "aborted"
    // the prebuild timed out
    | "timeout"
    // the prebuild has finished (even if a headless task failed) and a snapshot is available
    | "available"
    // the prebuild (headless workspace) failed due to some system error
    | "failed";

export interface PrebuiltWorkspace {
    id: string;
    cloneURL: string;
    branch?: string;
    projectId?: string;
    commit: string;
    buildWorkspaceId: string;
    creationTime: string;
    state: PrebuiltWorkspaceState;
    statusVersion: number;
    error?: string;
    snapshot?: string;
}

export namespace PrebuiltWorkspace {
    export function isDone(pws: PrebuiltWorkspace) {
        return (
            pws.state === "available" || pws.state === "timeout" || pws.state === "aborted" || pws.state === "failed"
        );
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
    /**
     * the commitSHA of the commit that triggered the prebuild
     */
    commitSHA?: string;
    issue?: string;
    contextUrl?: string;
}

export interface WhitelistedRepository {
    url: string;
    name: string;
    description?: string;
    avatar?: string;
}

export type PortOnOpen = "open-browser" | "open-preview" | "notify" | "ignore";

export interface PortConfig {
    port: number;
    onOpen?: PortOnOpen;
    visibility?: PortVisibility;
    protocol?: PortProtocol;
    description?: string;
    name?: string;
}
export namespace PortConfig {
    export function is(config: any): config is PortConfig {
        return config && "port" in config && typeof config.port === "number";
    }
}

export interface PortRangeConfig {
    port: string;
    onOpen?: PortOnOpen;
}
export namespace PortRangeConfig {
    export function is(config: any): config is PortRangeConfig {
        return config && "port" in config && (typeof config.port === "string" || config.port instanceof String);
    }
}

export interface TaskConfig {
    name?: string;
    before?: string;
    init?: string;
    prebuild?: string;
    command?: string;
    env?: { [env: string]: any };
    openIn?: "bottom" | "main" | "left" | "right";
    openMode?: "split-top" | "split-left" | "split-right" | "split-bottom" | "tab-before" | "tab-after";
}

export namespace TaskConfig {
    export function is(config: any): config is TaskConfig {
        return config && ("command" in config || "init" in config || "before" in config);
    }
}

export namespace WorkspaceImageBuild {
    export type Phase = "BaseImage" | "GitpodLayer" | "Error" | "Done";
    export interface StateInfo {
        phase: Phase;
        currentStep?: number;
        maxSteps?: number;
    }
    export interface LogContent {
        text: string;
        upToLine?: number;
        isDiff?: boolean;
    }
    export type LogCallback = (info: StateInfo, content: LogContent | undefined) => void;
    export namespace LogLine {
        export const DELIMITER = "\r\n";
        export const DELIMITER_REGEX = /\r?\n/;
    }
}

export type ImageConfig = ImageConfigString | ImageConfigFile;
export type ImageConfigString = string;
export namespace ImageConfigString {
    export function is(config: ImageConfig | undefined): config is ImageConfigString {
        return typeof config === "string";
    }
}
export interface ImageConfigFile {
    // Path to the Dockerfile relative to repository root
    file: string;
    // Path to the docker build context relative to repository root
    context?: string;
}
export namespace ImageConfigFile {
    export function is(config: ImageConfig | undefined): config is ImageConfigFile {
        return typeof config === "object" && "file" in config;
    }
}
export interface ExternalImageConfigFile extends ImageConfigFile {
    externalSource: Commit;
}
export namespace ExternalImageConfigFile {
    export function is(config: any | undefined): config is ExternalImageConfigFile {
        return typeof config === "object" && "file" in config && "externalSource" in config;
    }
}

export interface WorkspaceContext {
    title: string;
    ref?: string;
    /** This contains the URL portion of the contextURL (which might contain other modifiers as well). It's optional because it's not set for older workspaces. */
    normalizedContextURL?: string;
    forceCreateNewWorkspace?: boolean;
    forceImageBuild?: boolean;
}

export namespace WorkspaceContext {
    export function is(context: any): context is WorkspaceContext {
        return context && "title" in context;
    }
}

export interface WithSnapshot {
    snapshotBucketId: string;
}
export namespace WithSnapshot {
    export function is(context: any): context is WithSnapshot {
        return context && "snapshotBucketId" in context;
    }
}

export interface WithPrebuild extends WithSnapshot {
    prebuildWorkspaceId: string;
    wasPrebuilt: true;
}
export namespace WithPrebuild {
    export function is(context: any): context is WithPrebuild {
        return context && WithSnapshot.is(context) && "prebuildWorkspaceId" in context && "wasPrebuilt" in context;
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
        return context && "withDefaultConfig" in context && context.withDefaultConfig;
    }

    export function mark(ctx: WorkspaceContext): WorkspaceContext & WithDefaultConfig {
        return {
            ...ctx,
            withDefaultConfig: true,
        };
    }
}

export interface SnapshotContext extends WorkspaceContext, WithSnapshot {
    snapshotId: string;
}

export namespace SnapshotContext {
    export function is(context: any): context is SnapshotContext {
        return context && WithSnapshot.is(context) && "snapshotId" in context;
    }
}

export interface WithCommitHistory {
    commitHistory?: string[];
    additionalRepositoryCommitHistories?: {
        cloneUrl: string;
        commitHistory: string[];
    }[];
}

export interface StartPrebuildContext extends WorkspaceContext, WithCommitHistory {
    actual: WorkspaceContext;
    project: Project;
    branch?: string;
}

export namespace StartPrebuildContext {
    export function is(context: any): context is StartPrebuildContext {
        return context && "actual" in context;
    }
}

export interface PrebuiltWorkspaceContext extends WorkspaceContext {
    originalContext: WorkspaceContext;
    prebuiltWorkspace: PrebuiltWorkspace;
    snapshotBucketId?: string;
}

export namespace PrebuiltWorkspaceContext {
    export function is(context: any): context is PrebuiltWorkspaceContext {
        return context && "originalContext" in context && "prebuiltWorkspace" in context;
    }
}

export interface WithReferrerContext extends WorkspaceContext {
    referrer: string;
    referrerIde?: string;
}

export namespace WithReferrerContext {
    export function is(context: any): context is WithReferrerContext {
        return context && "referrer" in context;
    }
}

export interface WithEnvvarsContext extends WorkspaceContext {
    envvars: EnvVarWithValue[];
}

export namespace WithEnvvarsContext {
    export function is(context: any): context is WithEnvvarsContext {
        return context && "envvars" in context;
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
    };
}

export interface Commit {
    repository: Repository;
    revision: string;

    // Might contain either a branch or a tag (determined by refType)
    ref?: string;

    // refType is only set if ref is present (and not for old workspaces, before this feature was added)
    refType?: RefType;
}

export interface AdditionalContentContext extends WorkspaceContext {
    /**
     * utf-8 encoded contents that will be copied on top of the workspace's filesystem
     */
    additionalFiles: { [filePath: string]: string };
}

export namespace AdditionalContentContext {
    export function is(ctx: any): ctx is AdditionalContentContext {
        return "additionalFiles" in ctx;
    }

    export function hasDockerConfig(ctx: any, config: WorkspaceConfig): boolean {
        return is(ctx) && ImageConfigFile.is(config.image) && !!ctx.additionalFiles[config.image.file];
    }
}

export interface OpenPrebuildContext extends WorkspaceContext {
    openPrebuildID: string;
}

export namespace OpenPrebuildContext {
    export function is(ctx: any): ctx is OpenPrebuildContext {
        return "openPrebuildID" in ctx;
    }
}

export interface CommitContext extends WorkspaceContext, GitCheckoutInfo {
    /** @deprecated Moved to .repository.cloneUrl, left here for backwards-compatibility for old workspace contextes in the DB */
    cloneUrl?: string;

    /**
     * The clone and checkout information for additional repositories in case of multi-repo projects.
     */
    additionalRepositoryCheckoutInfo?: GitCheckoutInfo[];
}

export namespace CommitContext {
    /**
     * Creates a hash for all the commits of the CommitContext and all sub-repo commit infos.
     * The hash is max 255 chars long.
     * @param commitContext
     * @returns hash for commitcontext
     */
    export function computeHash(commitContext: CommitContext): string {
        // for single commits we use the revision to be backward compatible.
        if (
            !commitContext.additionalRepositoryCheckoutInfo ||
            commitContext.additionalRepositoryCheckoutInfo.length === 0
        ) {
            return commitContext.revision;
        }
        const hasher = createHash("sha256");
        hasher.update(commitContext.revision);
        for (const info of commitContext.additionalRepositoryCheckoutInfo) {
            hasher.update(info.revision);
        }
        return hasher.digest("hex");
    }
}

export interface GitCheckoutInfo extends Commit {
    checkoutLocation?: string;
    upstreamRemoteURI?: string;
    localBranch?: string;
}

export namespace CommitContext {
    export function is(commit: any): commit is CommitContext {
        return WorkspaceContext.is(commit) && "repository" in commit && "revision" in commit;
    }
}

export interface PullRequestContext extends CommitContext {
    nr: number;
    ref: string;
    base: {
        repository: Repository;
        ref: string;
    };
}

export namespace PullRequestContext {
    export function is(ctx: any): ctx is PullRequestContext {
        return CommitContext.is(ctx) && "nr" in ctx && "ref" in ctx && "base" in ctx;
    }
}

export interface IssueContext extends CommitContext {
    nr: number;
    ref: string;
    localBranch: string;
}

export namespace IssueContext {
    export function is(ctx: any): ctx is IssueContext {
        return CommitContext.is(ctx) && "nr" in ctx && "ref" in ctx && "localBranch" in ctx;
    }
}

export interface NavigatorContext extends CommitContext {
    path: string;
    isFile: boolean;
}

export namespace NavigatorContext {
    export function is(ctx: any): ctx is NavigatorContext {
        return CommitContext.is(ctx) && "path" in ctx && "isFile" in ctx;
    }
}

export interface Repository {
    host: string;
    owner: string;
    name: string;
    cloneUrl: string;
    /* Optional kind to differentiate between repositories of orgs/groups/projects and personal repos. */
    repoKind?: string;
    description?: string;
    avatarUrl?: string;
    webUrl?: string;
    defaultBranch?: string;
    /** Optional for backwards compatibility */
    private?: boolean;
    fork?: {
        // The direct parent of this fork
        parent: Repository;
    };
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
    portsOpened: number[];
    portsClosed: number[];
}

export namespace WorkspaceInstancePortsChangedEvent {
    export function is(data: any): data is WorkspaceInstancePortsChangedEvent {
        return data && data.type == "PortsChanged";
    }
}

export interface WorkspaceInfo {
    workspace: Workspace;
    latestInstance?: WorkspaceInstance;
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
        prebuildID: string;
        workspaceID: string;
        instanceID: string;
        starting: RunningWorkspacePrebuildStarting;
        sameCluster: boolean;
    };
    runningPrebuildWorkspaceID?: string;
}
export type RunningWorkspacePrebuildStarting = "queued" | "starting" | "running";

export namespace WorkspaceCreationResult {
    export function is(data: any): data is WorkspaceCreationResult {
        return (
            data &&
            ("createdWorkspaceId" in data ||
                "existingWorkspaces" in data ||
                "runningWorkspacePrebuild" in data ||
                "runningPrebuildWorkspaceID" in data)
        );
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
    readonly organizationId?: string;
    readonly verified: boolean;
    readonly isReadonly?: boolean;
    readonly hiddenOnDashboard?: boolean;
    readonly disallowLogin?: boolean;
    readonly icon?: string;
    readonly description?: string;

    readonly settingsUrl?: string;
    readonly scopes?: string[];
    readonly requirements?: {
        readonly default: string[];
        readonly publicRepo: string[];
        readonly privateRepo: string[];
    };
}

export interface AuthProviderEntry {
    readonly id: string;
    readonly type: AuthProviderEntry.Type;
    readonly host: string;
    readonly ownerId: string;
    readonly organizationId?: string;

    readonly status: AuthProviderEntry.Status;

    readonly oauth: OAuth2Config;
    /** A random string that is to change whenever oauth changes (enforced on DB level) */
    readonly oauthRevision?: string;
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
    readonly authorizationParams?: { [key: string]: string };
}

export namespace AuthProviderEntry {
    export type Type = "GitHub" | "GitLab" | string;
    export type Status = "pending" | "verified";
    export type NewEntry = Pick<AuthProviderEntry, "ownerId" | "host" | "type"> & {
        clientId?: string;
        clientSecret?: string;
    };
    export type UpdateEntry = Pick<AuthProviderEntry, "id" | "ownerId"> &
        Pick<OAuth2Config, "clientId" | "clientSecret">;
    export type NewOrgEntry = NewEntry & {
        organizationId: string;
    };
    export type UpdateOrgEntry = Pick<AuthProviderEntry, "id"> & {
        clientId: string;
        clientSecret: string;
        organizationId: string;
    };
    export function redact(entry: AuthProviderEntry): AuthProviderEntry {
        return {
            ...entry,
            oauth: {
                ...entry.oauth,
                clientSecret: "redacted",
            },
        };
    }
}

export interface Configuration {
    readonly daysBeforeGarbageCollection: number;
    readonly garbageCollectionStartDate: number;
    readonly isSingleOrgInstallation: boolean;
}

export interface StripeConfig {
    individualUsagePriceIds: { [currency: string]: string };
    teamUsagePriceIds: { [currency: string]: string };
}

export interface LinkedInProfile {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture: string;
    emailAddress: string;
}

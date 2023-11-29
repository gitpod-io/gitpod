/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Timestamp, toPlainMessage } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
    FailedPreconditionDetails,
    ImageBuildLogsNotYetAvailableError,
    InvalidCostCenterError as InvalidCostCenterErrorData,
    InvalidGitpodYMLError as InvalidGitpodYMLErrorData,
    NeedsVerificationError,
    PaymentSpendingLimitReachedError,
    PermissionDeniedDetails,
    RepositoryNotFoundError as RepositoryNotFoundErrorData,
    RepositoryUnauthorizedError as RepositoryUnauthorizedErrorData,
    TooManyRunningWorkspacesError,
    UserBlockedError,
} from "@gitpod/public-api/lib/gitpod/v1/error_pb";
import {
    AuthProvider,
    AuthProviderDescription,
    AuthProviderType,
    OAuth2Config,
} from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import {
    BranchMatchingStrategy,
    Configuration,
    PrebuildSettings,
    WorkspaceSettings,
} from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import {
    Organization,
    OrganizationMember,
    OrganizationRole,
    OrganizationSettings,
} from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import {
    AdmissionLevel,
    Workspace,
    WorkspaceConditions,
    WorkspaceEnvironmentVariable,
    WorkspaceGitStatus,
    WorkspacePhase,
    WorkspacePhase_Phase,
    WorkspacePort,
    WorkspacePort_Policy,
    WorkspacePort_Protocol,
    WorkspaceStatus,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { EditorReference } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";
import { SSHPublicKey } from "@gitpod/public-api/lib/gitpod/v1/ssh_pb";
import {
    ConfigurationEnvironmentVariable,
    EnvironmentVariableAdmission,
    UserEnvironmentVariable,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { SCMToken, SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { ContextURL } from "@gitpod/gitpod-protocol/lib/context-url";
import {
    Prebuild,
    PrebuildStatus,
    PrebuildPhase,
    PrebuildPhase_Phase,
} from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { InvalidGitpodYMLError, RepositoryNotFoundError, UnauthorizedRepositoryAccessError } from "./public-api-errors";
import {
    AuthProviderEntry as AuthProviderProtocol,
    AuthProviderInfo,
    CommitContext,
    EnvVarWithValue,
    Workspace as ProtocolWorkspace,
    WithEnvvarsContext,
    WithPrebuild,
    WorkspaceContext,
    WorkspaceInfo,
    WorkspaceClasses,
    UserEnvVarValue,
    ProjectEnvVar,
    PrebuiltWorkspaceState,
    Token,
    SuggestedRepository as SuggestedRepositoryProtocol,
    UserSSHPublicKeyValue,
} from "@gitpod/gitpod-protocol/lib//protocol";
import {
    OrgMemberInfo,
    OrgMemberRole,
    OrganizationSettings as OrganizationSettingsProtocol,
    PartialProject,
    PrebuildSettings as PrebuildSettingsProtocol,
    PrebuildWithStatus,
    Project,
    Organization as ProtocolOrganization,
} from "@gitpod/gitpod-protocol/lib//teams-projects-protocol";
import {
    ConfigurationIdeConfig,
    PortProtocol,
    WorkspaceInstance,
    WorkspaceInstanceConditions,
    WorkspaceInstancePort,
} from "@gitpod/gitpod-protocol/lib//workspace-instance";
import { Author, Commit } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import type { DeepPartial } from "@gitpod/gitpod-protocol/lib/util/deep-partial";

export type PartialConfiguration = DeepPartial<Configuration> & Pick<Configuration, "id">;

/**
 * Converter between gRPC and JSON-RPC types.
 *
 * Use following conventions:
 * - methods converting from JSON-RPC to gRPC is called `to*`
 * - methods converting from gRPC to JSON-RPC is called `from*`
 */
export class PublicAPIConverter {
    toWorkspace(arg: WorkspaceInfo | WorkspaceInstance, current?: Workspace): Workspace {
        const workspace = current ?? new Workspace();

        if ("workspace" in arg) {
            workspace.id = arg.workspace.id;
            workspace.prebuild = arg.workspace.type === "prebuild";
            workspace.organizationId = arg.workspace.organizationId;
            workspace.name = arg.workspace.description;
            workspace.pinned = arg.workspace.pinned ?? false;

            const contextUrl = ContextURL.normalize(arg.workspace);
            if (contextUrl) {
                workspace.contextUrl = contextUrl;
            }
            if (WithPrebuild.is(arg.workspace.context)) {
                workspace.prebuildId = arg.workspace.context.prebuildWorkspaceId;
            }

            const status = new WorkspaceStatus();
            const phase = new WorkspacePhase();
            phase.lastTransitionTime = Timestamp.fromDate(new Date(arg.workspace.creationTime));
            status.phase = phase;
            status.admission = this.toAdmission(arg.workspace.shareable);
            status.gitStatus = this.toGitStatus(arg.workspace);
            workspace.status = status;
            workspace.additionalEnvironmentVariables = this.toWorkspaceEnvironmentVariables(arg.workspace.context);

            if (arg.latestInstance) {
                return this.toWorkspace(arg.latestInstance, workspace);
            }
            return workspace;
        }

        const status = workspace.status ?? new WorkspaceStatus();
        workspace.status = status;
        const phase = status.phase ?? new WorkspacePhase();
        phase.name = this.toPhase(arg);
        status.phase = phase;

        let lastTransitionTime = new Date(arg.creationTime).getTime();
        if (phase.lastTransitionTime) {
            lastTransitionTime = Math.max(lastTransitionTime, new Date(phase.lastTransitionTime.toDate()).getTime());
        }
        if (arg.deployedTime) {
            lastTransitionTime = Math.max(lastTransitionTime, new Date(arg.deployedTime).getTime());
        }
        if (arg.startedTime) {
            lastTransitionTime = Math.max(lastTransitionTime, new Date(arg.startedTime).getTime());
        }
        if (arg.stoppingTime) {
            lastTransitionTime = Math.max(lastTransitionTime, new Date(arg.stoppingTime).getTime());
        }
        if (arg.stoppedTime) {
            lastTransitionTime = Math.max(lastTransitionTime, new Date(arg.stoppedTime).getTime());
        }
        phase.lastTransitionTime = Timestamp.fromDate(new Date(lastTransitionTime));

        status.instanceId = arg.id;
        if (arg.status.message) {
            status.message = arg.status.message;
        }
        status.workspaceUrl = arg.ideUrl;
        status.ports = this.toPorts(arg.status.exposedPorts);
        status.conditions = this.toWorkspaceConditions(arg.status.conditions);
        status.gitStatus = this.toGitStatus(arg, status.gitStatus);
        workspace.region = arg.region;
        if (arg.workspaceClass) {
            workspace.workspaceClass = arg.workspaceClass;
        }
        workspace.editor = this.toEditor(arg.configuration.ideConfig);

        return workspace;
    }

    toWorkspaceConditions(conditions: WorkspaceInstanceConditions): WorkspaceConditions {
        return new WorkspaceConditions({
            failed: conditions.failed,
            timeout: conditions.timeout,
        });
    }

    toEditor(ideConfig: ConfigurationIdeConfig | undefined): EditorReference | undefined {
        if (!ideConfig?.ide) {
            return undefined;
        }
        const result = new EditorReference();
        result.name = ideConfig.ide;
        result.version = ideConfig.useLatest ? "latest" : "stable";
        return result;
    }

    toError(reason: unknown): ConnectError {
        if (reason instanceof ConnectError) {
            return reason;
        }
        if (reason instanceof ApplicationError) {
            if (reason.code === ErrorCodes.USER_BLOCKED) {
                return new ConnectError(
                    reason.message,
                    Code.PermissionDenied,
                    undefined,
                    [
                        new PermissionDeniedDetails({
                            reason: {
                                case: "userBlocked",
                                value: new UserBlockedError(),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason.code === ErrorCodes.NEEDS_VERIFICATION) {
                return new ConnectError(
                    reason.message,
                    Code.PermissionDenied,
                    undefined,
                    [
                        new PermissionDeniedDetails({
                            reason: {
                                case: "needsVerification",
                                value: new NeedsVerificationError(),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason instanceof InvalidGitpodYMLError) {
                return new ConnectError(
                    reason.message,
                    Code.FailedPrecondition,
                    undefined,
                    [
                        new FailedPreconditionDetails({
                            reason: {
                                case: "invalidGitpodYml",
                                value: new InvalidGitpodYMLErrorData(reason.info),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason instanceof RepositoryNotFoundError) {
                return new ConnectError(
                    reason.message,
                    Code.FailedPrecondition,
                    undefined,
                    [
                        new FailedPreconditionDetails({
                            reason: {
                                case: "repositoryNotFound",
                                value: new RepositoryNotFoundErrorData(reason.info),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason instanceof UnauthorizedRepositoryAccessError) {
                return new ConnectError(
                    reason.message,
                    Code.FailedPrecondition,
                    undefined,
                    [
                        new FailedPreconditionDetails({
                            reason: {
                                case: "repositoryUnauthorized",
                                value: new RepositoryUnauthorizedErrorData(reason.info),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason.code === ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED) {
                return new ConnectError(
                    reason.message,
                    Code.FailedPrecondition,
                    undefined,
                    [
                        new FailedPreconditionDetails({
                            reason: {
                                case: "paymentSpendingLimitReached",
                                value: new PaymentSpendingLimitReachedError(),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason.code === ErrorCodes.INVALID_COST_CENTER) {
                return new ConnectError(
                    reason.message,
                    Code.FailedPrecondition,
                    undefined,
                    [
                        new FailedPreconditionDetails({
                            reason: {
                                case: "invalidCostCenter",
                                value: new InvalidCostCenterErrorData({
                                    attributionId: reason.data.attributionId,
                                }),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason.code === ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE) {
                return new ConnectError(
                    reason.message,
                    Code.FailedPrecondition,
                    undefined,
                    [
                        new FailedPreconditionDetails({
                            reason: {
                                case: "imageBuildLogsNotYetAvailable",
                                value: new ImageBuildLogsNotYetAvailableError(),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason.code === ErrorCodes.TOO_MANY_RUNNING_WORKSPACES) {
                return new ConnectError(
                    reason.message,
                    Code.FailedPrecondition,
                    undefined,
                    [
                        new FailedPreconditionDetails({
                            reason: {
                                case: "tooManyRunningWorkspaces",
                                value: new TooManyRunningWorkspacesError(),
                            },
                        }),
                    ],
                    reason,
                );
            }
            if (reason.code === ErrorCodes.NOT_FOUND) {
                return new ConnectError(reason.message, Code.NotFound, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.NOT_AUTHENTICATED) {
                return new ConnectError(reason.message, Code.Unauthenticated, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.PERMISSION_DENIED) {
                return new ConnectError(reason.message, Code.PermissionDenied, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.CONFLICT) {
                return new ConnectError(reason.message, Code.AlreadyExists, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.PRECONDITION_FAILED) {
                return new ConnectError(reason.message, Code.FailedPrecondition, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.TOO_MANY_REQUESTS) {
                return new ConnectError(reason.message, Code.ResourceExhausted, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.CANCELLED) {
                return new ConnectError(reason.message, Code.Canceled, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.INTERNAL_SERVER_ERROR) {
                return new ConnectError(reason.message, Code.Internal, undefined, undefined, reason);
            }
            return new ConnectError(reason.message, Code.Unknown, undefined, undefined, reason);
        }
        return ConnectError.from(reason, Code.Internal);
    }

    fromError(reason: ConnectError): ApplicationError {
        if (reason.code === Code.NotFound) {
            return new ApplicationError(ErrorCodes.NOT_FOUND, reason.rawMessage);
        }
        if (reason.code === Code.Unauthenticated) {
            return new ApplicationError(ErrorCodes.NOT_AUTHENTICATED, reason.rawMessage);
        }
        if (reason.code === Code.PermissionDenied) {
            const details = reason.findDetails(PermissionDeniedDetails)[0];
            switch (details?.reason?.case) {
                case "userBlocked":
                    return new ApplicationError(ErrorCodes.USER_BLOCKED, reason.rawMessage);
                case "needsVerification":
                    return new ApplicationError(ErrorCodes.NEEDS_VERIFICATION, reason.rawMessage);
            }
            return new ApplicationError(ErrorCodes.PERMISSION_DENIED, reason.rawMessage);
        }
        if (reason.code === Code.AlreadyExists) {
            return new ApplicationError(ErrorCodes.CONFLICT, reason.rawMessage);
        }
        if (reason.code === Code.FailedPrecondition) {
            const details = reason.findDetails(FailedPreconditionDetails)[0];
            switch (details?.reason?.case) {
                case "invalidGitpodYml":
                    const invalidGitpodYmlInfo = toPlainMessage(details.reason.value);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    return new InvalidGitpodYMLError(invalidGitpodYmlInfo);
                case "repositoryNotFound":
                    const repositoryNotFoundInfo = toPlainMessage(details.reason.value);
                    return new RepositoryNotFoundError(repositoryNotFoundInfo);
                case "repositoryUnauthorized":
                    const repositoryUnauthorizedInfo = toPlainMessage(details.reason.value);
                    return new UnauthorizedRepositoryAccessError(repositoryUnauthorizedInfo);
                case "paymentSpendingLimitReached":
                    return new ApplicationError(ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED, reason.rawMessage);
                case "invalidCostCenter":
                    const invalidCostCenterInfo = toPlainMessage(details.reason.value);
                    return new ApplicationError(
                        ErrorCodes.INVALID_COST_CENTER,
                        reason.rawMessage,
                        invalidCostCenterInfo,
                    );
                case "imageBuildLogsNotYetAvailable":
                    return new ApplicationError(ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE, reason.rawMessage);
                case "tooManyRunningWorkspaces":
                    return new ApplicationError(ErrorCodes.TOO_MANY_RUNNING_WORKSPACES, reason.rawMessage);
            }
            return new ApplicationError(ErrorCodes.PRECONDITION_FAILED, reason.rawMessage);
        }
        if (reason.code === Code.ResourceExhausted) {
            return new ApplicationError(ErrorCodes.TOO_MANY_REQUESTS, reason.rawMessage);
        }
        if (reason.code === Code.Canceled) {
            return new ApplicationError(ErrorCodes.CANCELLED, reason.rawMessage);
        }
        if (reason.code === Code.Internal) {
            return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, reason.rawMessage);
        }
        return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, reason.rawMessage);
    }

    toWorkspaceEnvironmentVariables(context: WorkspaceContext): WorkspaceEnvironmentVariable[] {
        if (WithEnvvarsContext.is(context)) {
            return context.envvars.map((envvar) => this.toWorkspaceEnvironmentVariable(envvar));
        }
        return [];
    }

    toWorkspaceEnvironmentVariable(envVar: EnvVarWithValue): WorkspaceEnvironmentVariable {
        const result = new WorkspaceEnvironmentVariable();
        result.name = envVar.name;
        result.value = envVar.value;
        return result;
    }

    toUserEnvironmentVariable(envVar: UserEnvVarValue): UserEnvironmentVariable {
        const result = new UserEnvironmentVariable();
        result.id = envVar.id || "";
        result.name = envVar.name;
        result.value = envVar.value;
        result.repositoryPattern = envVar.repositoryPattern;
        return result;
    }

    toConfigurationEnvironmentVariable(envVar: ProjectEnvVar): ConfigurationEnvironmentVariable {
        const result = new ConfigurationEnvironmentVariable();
        result.id = envVar.id || "";
        result.name = envVar.name;
        result.configurationId = envVar.projectId;
        result.admission = envVar.censored
            ? EnvironmentVariableAdmission.PREBUILD
            : EnvironmentVariableAdmission.EVERYWHERE;
        return result;
    }

    toAdmission(shareable: boolean | undefined): AdmissionLevel {
        if (shareable) {
            return AdmissionLevel.EVERYONE;
        }
        return AdmissionLevel.OWNER_ONLY;
    }

    toPorts(ports: WorkspaceInstancePort[] | undefined): WorkspacePort[] {
        if (!ports) {
            return [];
        }
        return ports.map((port) => this.toPort(port));
    }

    toPort(port: WorkspaceInstancePort): WorkspacePort {
        const result = new WorkspacePort();
        result.port = BigInt(port.port);
        if (port.url) {
            result.url = port.url;
        }
        result.policy = this.toPortPolicy(port.visibility);
        result.protocol = this.toPortProtocol(port.protocol);
        return result;
    }

    toPortProtocol(protocol: PortProtocol | undefined): WorkspacePort_Protocol {
        switch (protocol) {
            case "https":
                return WorkspacePort_Protocol.HTTPS;
            default:
                return WorkspacePort_Protocol.HTTP;
        }
    }

    toPortPolicy(visibility: string | undefined): WorkspacePort_Policy {
        switch (visibility) {
            case "public":
                return WorkspacePort_Policy.PUBLIC;
            default:
                return WorkspacePort_Policy.PRIVATE;
        }
    }

    toGitStatus(
        arg: WorkspaceInfo | ProtocolWorkspace | WorkspaceInstance,
        current?: WorkspaceGitStatus,
    ): WorkspaceGitStatus {
        let result = current ?? new WorkspaceGitStatus();
        if ("workspace" in arg) {
            result = this.toGitStatus(arg.workspace, result);
            if (arg.latestInstance) {
                result = this.toGitStatus(arg.latestInstance, result);
            }
            return result;
        }
        if ("context" in arg) {
            const context = arg.context;
            if (CommitContext.is(context)) {
                result.cloneUrl = context.repository.cloneUrl;
                if (context.ref) {
                    result.branch = context.ref;
                }
                result.latestCommit = context.revision;
            }
            return result;
        }
        const gitStatus = arg?.gitStatus;
        if (gitStatus) {
            result.branch = gitStatus.branch ?? result.branch;
            result.latestCommit = gitStatus.latestCommit ?? result.latestCommit;
            result.uncommitedFiles = gitStatus.uncommitedFiles || [];
            result.totalUncommitedFiles = gitStatus.totalUncommitedFiles || 0;
            result.untrackedFiles = gitStatus.untrackedFiles || [];
            result.totalUntrackedFiles = gitStatus.totalUntrackedFiles || 0;
            result.unpushedCommits = gitStatus.unpushedCommits || [];
            result.totalUnpushedCommits = gitStatus.totalUnpushedCommits || 0;
        }
        return result;
    }

    toPhase(arg: WorkspaceInstance): WorkspacePhase_Phase {
        if ("status" in arg) {
            switch (arg.status.phase) {
                case "unknown":
                    return WorkspacePhase_Phase.UNSPECIFIED;
                case "preparing":
                    return WorkspacePhase_Phase.PREPARING;
                case "building":
                    return WorkspacePhase_Phase.IMAGEBUILD;
                case "pending":
                    return WorkspacePhase_Phase.PENDING;
                case "creating":
                    return WorkspacePhase_Phase.CREATING;
                case "initializing":
                    return WorkspacePhase_Phase.INITIALIZING;
                case "running":
                    return WorkspacePhase_Phase.RUNNING;
                case "interrupted":
                    return WorkspacePhase_Phase.INTERRUPTED;
                case "stopping":
                    return WorkspacePhase_Phase.STOPPING;
                case "stopped":
                    return WorkspacePhase_Phase.STOPPED;
            }
        }
        return WorkspacePhase_Phase.UNSPECIFIED;
    }

    toOrganization(org: ProtocolOrganization): Organization {
        const result = new Organization();
        result.id = org.id;
        result.name = org.name;
        result.slug = org.slug || "";
        result.creationTime = Timestamp.fromDate(new Date(org.creationTime));
        return result;
    }

    toOrganizationMember(member: OrgMemberInfo): OrganizationMember {
        return new OrganizationMember({
            userId: member.userId,
            fullName: member.fullName,
            email: member.primaryEmail,
            avatarUrl: member.avatarUrl,
            role: this.toOrgMemberRole(member.role),
            memberSince: Timestamp.fromDate(new Date(member.memberSince)),
            ownedByOrganization: member.ownedByOrganization,
        });
    }

    toOrgMemberRole(role: OrgMemberRole): OrganizationRole {
        switch (role) {
            case "owner":
                return OrganizationRole.OWNER;
            case "member":
                return OrganizationRole.MEMBER;
            default:
                return OrganizationRole.UNSPECIFIED;
        }
    }

    fromOrgMemberRole(role: OrganizationRole): OrgMemberRole {
        switch (role) {
            case OrganizationRole.OWNER:
                return "owner";
            case OrganizationRole.MEMBER:
                return "member";
            default:
                throw new Error(`unknown org member role ${role}`);
        }
    }

    fromWorkspaceSettings(workspaceClass?: string): WorkspaceClasses {
        const result: WorkspaceClasses = {};
        if (workspaceClass) {
            result.regular = workspaceClass;
        }
        return result;
    }

    fromBranchMatchingStrategy(
        branchStrategy?: BranchMatchingStrategy,
    ): PrebuildSettingsProtocol.BranchStrategy | undefined {
        switch (branchStrategy) {
            case BranchMatchingStrategy.DEFAULT_BRANCH:
                return "default-branch";
            case BranchMatchingStrategy.ALL_BRANCHES:
                return "all-branches";
            case BranchMatchingStrategy.MATCHED_BRANCHES:
                return "matched-branches";
            default:
                return undefined;
        }
    }

    fromPartialPrebuildSettings(prebuilds?: DeepPartial<PrebuildSettings>): DeepPartial<PrebuildSettingsProtocol> {
        const result: PrebuildSettingsProtocol = {};
        if (prebuilds) {
            result.enable = !!prebuilds.enabled;
            result.branchMatchingPattern = prebuilds.branchMatchingPattern;
            result.branchStrategy = this.fromBranchMatchingStrategy(prebuilds.branchStrategy);
            result.prebuildInterval = prebuilds.prebuildInterval;
            result.workspaceClass = prebuilds.workspaceClass;
        }
        return result;
    }

    fromCreationTime(creationTime?: Timestamp): string {
        if (!creationTime) {
            return "";
        }
        return creationTime.toDate().toISOString();
    }

    fromPartialConfiguration(configuration: PartialConfiguration): PartialProject {
        const prebuilds = this.fromPartialPrebuildSettings(configuration.prebuildSettings);
        const workspaceClasses = this.fromWorkspaceSettings(configuration.workspaceSettings?.workspaceClass);
        const result: PartialProject = {
            id: configuration.id,
        };

        if (configuration.name !== undefined) {
            result.name = configuration.name;
        }

        if (Object.keys(prebuilds).length > 0 || Object.keys(workspaceClasses).length > 0) {
            result.settings = {
                prebuilds,
                workspaceClasses,
            };
        }

        return result;
    }

    toOrganizationSettings(settings: OrganizationSettingsProtocol): OrganizationSettings {
        return new OrganizationSettings({
            workspaceSharingDisabled: !!settings.workspaceSharingDisabled,
            defaultWorkspaceImage: settings.defaultWorkspaceImage || undefined,
        });
    }

    toConfiguration(project: Project): Configuration {
        const result = new Configuration();
        result.id = project.id;
        result.organizationId = project.teamId;
        result.name = project.name;
        result.cloneUrl = project.cloneUrl;
        result.creationTime = Timestamp.fromDate(new Date(project.creationTime));
        result.workspaceSettings = this.toWorkspaceSettings(project.settings?.workspaceClasses?.regular);
        result.prebuildSettings = this.toPrebuildSettings(project.settings?.prebuilds);
        return result;
    }

    toPrebuildSettings(prebuilds?: PrebuildSettingsProtocol): PrebuildSettings {
        const result = new PrebuildSettings();
        if (prebuilds) {
            result.enabled = !!prebuilds.enable;
            result.branchMatchingPattern = prebuilds.branchMatchingPattern ?? "";
            result.branchStrategy = this.toBranchMatchingStrategy(prebuilds.branchStrategy);
            result.prebuildInterval = prebuilds.prebuildInterval ?? 20;
            result.workspaceClass = prebuilds.workspaceClass ?? "";
        }
        return result;
    }

    toBranchMatchingStrategy(branchStrategy?: PrebuildSettingsProtocol.BranchStrategy): BranchMatchingStrategy {
        switch (branchStrategy) {
            case "default-branch":
                return BranchMatchingStrategy.DEFAULT_BRANCH;
            case "all-branches":
                return BranchMatchingStrategy.ALL_BRANCHES;
            case "matched-branches":
                return BranchMatchingStrategy.MATCHED_BRANCHES;
        }
        return BranchMatchingStrategy.DEFAULT_BRANCH;
    }

    toWorkspaceSettings(workspaceClass?: string): WorkspaceSettings {
        const result = new WorkspaceSettings();
        if (workspaceClass) {
            result.workspaceClass = workspaceClass;
        }
        return result;
    }

    toAuthProviderDescription(ap: AuthProviderInfo): AuthProviderDescription {
        const result = new AuthProviderDescription({
            id: ap.authProviderId,
            host: ap.host,
            description: ap.description,
            icon: ap.icon,
            type: this.toAuthProviderType(ap.authProviderType),
        });
        return result;
    }

    toAuthProvider(ap: AuthProviderProtocol): AuthProvider {
        const result = new AuthProvider({
            id: ap.id,
            host: ap.host,
            type: this.toAuthProviderType(ap.type),
            verified: ap.status === "verified",
            settingsUrl: ap.oauth?.settingsUrl,
            scopes: ap.oauth?.scope?.split(ap.oauth?.scopeSeparator || " ") || [],
        });
        if (ap.organizationId) {
            result.owner = {
                case: "organizationId",
                value: ap.organizationId,
            };
        } else {
            result.owner = {
                case: "ownerId",
                value: ap.ownerId,
            };
        }
        result.oauth2Config = this.toOAuth2Config(ap);
        return result;
    }

    toOAuth2Config(ap: AuthProviderProtocol): OAuth2Config {
        return new OAuth2Config({
            clientId: ap.oauth?.clientId,
            clientSecret: ap.oauth?.clientSecret,
        });
    }

    toAuthProviderType(type: string): AuthProviderType {
        switch (type) {
            case "GitHub":
                return AuthProviderType.GITHUB;
            case "GitLab":
                return AuthProviderType.GITLAB;
            case "Bitbucket":
                return AuthProviderType.BITBUCKET;
            case "BitbucketServer":
                return AuthProviderType.BITBUCKET_SERVER;
            default:
                return AuthProviderType.UNSPECIFIED; // not allowed
        }
    }

    fromAuthProviderType(type: AuthProviderType): string {
        switch (type) {
            case AuthProviderType.GITHUB:
                return "GitHub";
            case AuthProviderType.GITLAB:
                return "GitLab";
            case AuthProviderType.BITBUCKET:
                return "Bitbucket";
            case AuthProviderType.BITBUCKET_SERVER:
                return "BitbucketServer";
            default:
                return ""; // not allowed
        }
    }

    toPrebuilds(prebuilds: PrebuildWithStatus[]): Prebuild[] {
        return prebuilds.map((prebuild) => this.toPrebuild(prebuild));
    }

    toPrebuild(prebuild: PrebuildWithStatus): Prebuild {
        return new Prebuild({
            id: prebuild.info.id,
            workspaceId: prebuild.info.buildWorkspaceId,

            basedOnPrebuildId: prebuild.info.basedOnPrebuildId,

            configurationId: prebuild.info.projectId,
            ref: prebuild.info.branch,
            commit: new Commit({
                message: prebuild.info.changeTitle,
                author: new Author({
                    name: prebuild.info.changeAuthor,
                    avatarUrl: prebuild.info.changeAuthorAvatar,
                }),
                authorDate: Timestamp.fromDate(new Date(prebuild.info.changeDate)),
                sha: prebuild.info.changeHash,
            }),
            contextUrl: prebuild.info.changeUrl,

            status: this.toPrebuildStatus(prebuild),
        });
    }

    toPrebuildStatus(prebuild: PrebuildWithStatus): PrebuildStatus {
        return new PrebuildStatus({
            phase: new PrebuildPhase({
                name: this.toPrebuildPhase(prebuild.status),
            }),
            startTime: Timestamp.fromDate(new Date(prebuild.info.startedAt)),
            message: prebuild.error,
        });
    }

    toPrebuildPhase(status: PrebuiltWorkspaceState): PrebuildPhase_Phase {
        switch (status) {
            case "queued":
                return PrebuildPhase_Phase.QUEUED;
            case "building":
                return PrebuildPhase_Phase.BUILDING;
            case "aborted":
                return PrebuildPhase_Phase.ABORTED;
            case "timeout":
                return PrebuildPhase_Phase.TIMEOUT;
            case "available":
                return PrebuildPhase_Phase.AVAILABLE;
            case "failed":
                return PrebuildPhase_Phase.FAILED;
        }
        return PrebuildPhase_Phase.UNSPECIFIED;
    }

    toSCMToken(t: Token): SCMToken {
        return new SCMToken({
            username: t.username,
            value: t.value,
            refreshToken: t.refreshToken,
            expiryDate: t.expiryDate ? Timestamp.fromDate(new Date(t.expiryDate)) : undefined,
            updateDate: t.updateDate ? Timestamp.fromDate(new Date(t.updateDate)) : undefined,
            scopes: t.scopes,
            idToken: t.idToken,
        });
    }

    toSuggestedRepository(r: SuggestedRepositoryProtocol): SuggestedRepository {
        return new SuggestedRepository({
            url: r.url,
            repoName: r.repositoryName,
            configurationId: r.projectId,
            configurationName: r.projectName,
        });
    }

    toSSHPublicKey(sshKey: UserSSHPublicKeyValue): SSHPublicKey {
        const result = new SSHPublicKey();
        result.id = sshKey.id;
        result.name = sshKey.name;
        result.key = sshKey.key;
        result.fingerprint = sshKey.fingerprint;
        result.creationTime = Timestamp.fromDate(new Date(sshKey.creationTime));
        result.lastUsedTime = Timestamp.fromDate(new Date(sshKey.lastUsedTime || sshKey.creationTime));
        return result;
    }
}

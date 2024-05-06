/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { Timestamp, toPlainMessage, PartialMessage, Duration } from "@bufbuild/protobuf";
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
    Identity,
    SetWorkspaceAutoStartOptionsRequest_WorkspaceAutostartOption,
    User,
    RoleOrPermission,
    User_EmailNotificationSettings,
    User_UserFeatureFlag,
    User_WorkspaceAutostartOption,
    User_WorkspaceTimeoutSettings,
} from "@gitpod/public-api/lib/gitpod/v1/user_pb";
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
    CreateAndStartWorkspaceRequest,
    GitInitializer,
    GitInitializer_CloneTargetMode,
    GitInitializer_GitConfig,
    ParseContextURLResponse,
    PrebuildInitializer,
    SnapshotInitializer,
    UpdateWorkspaceRequest_UpdateTimeout,
    Workspace,
    WorkspaceClass,
    WorkspaceGitStatus,
    WorkspaceInitializer,
    WorkspaceInitializer_Spec,
    WorkspaceMetadata,
    WorkspacePhase,
    WorkspacePhase_Phase,
    WorkspacePort,
    WorkspacePort_Protocol,
    WorkspaceSnapshot,
    WorkspaceSpec,
    WorkspaceSpec_GitSpec,
    WorkspaceSpec_WorkspaceType,
    WorkspaceStatus,
    WorkspaceStatus_PrebuildResult,
    WorkspaceStatus_WorkspaceConditions,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { EditorReference } from "@gitpod/public-api/lib/gitpod/v1/editor_pb";
import {
    BlockedEmailDomain,
    BlockedRepository,
    OnboardingState,
} from "@gitpod/public-api/lib/gitpod/v1/installation_pb";
import { SSHPublicKey } from "@gitpod/public-api/lib/gitpod/v1/ssh_pb";
import {
    ConfigurationEnvironmentVariable,
    EnvironmentVariable,
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
    ListOrganizationPrebuildsRequest_Filter_State as PrebuildFilterState,
} from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { InvalidGitpodYMLError, RepositoryNotFoundError, UnauthorizedRepositoryAccessError } from "./public-api-errors";
import {
    User as UserProtocol,
    Identity as IdentityProtocol,
    AuthProviderEntry as AuthProviderProtocol,
    AuthProviderInfo,
    CommitContext,
    EnvVarWithValue,
    Workspace as ProtocolWorkspace,
    WithEnvvarsContext,
    WithPrebuild,
    WorkspaceContext,
    WorkspaceInfo,
    UserEnvVarValue,
    ProjectEnvVar,
    PrebuiltWorkspaceState,
    Token,
    SuggestedRepository as SuggestedRepositoryProtocol,
    UserSSHPublicKeyValue,
    SnapshotContext,
    EmailDomainFilterEntry,
    NamedWorkspaceFeatureFlag,
    WorkspaceAutostartOption,
    IDESettings,
    Snapshot,
} from "@gitpod/gitpod-protocol/lib/protocol";
import {
    OrgMemberInfo,
    OrgMemberRole,
    OrganizationSettings as OrganizationSettingsProtocol,
    PartialProject,
    PrebuildSettings as PrebuildSettingsProtocol,
    PrebuildWithStatus,
    Project,
    ProjectSettings,
    Organization as ProtocolOrganization,
} from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import {
    ConfigurationIdeConfig,
    PortProtocol,
    WorkspaceInstance,
    WorkspaceInstanceConditions,
    WorkspaceInstancePhase,
    WorkspaceInstancePort,
} from "@gitpod/gitpod-protocol/lib/workspace-instance";
import { Author, Commit } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import type { DeepPartial } from "@gitpod/gitpod-protocol/lib/util/deep-partial";
import { BlockedRepository as ProtocolBlockedRepository } from "@gitpod/gitpod-protocol/lib/blocked-repositories-protocol";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { RoleOrPermission as ProtocolRoleOrPermission } from "@gitpod/gitpod-protocol/lib/permission";
import { parseGoDurationToMs } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { isWorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { GitpodServer } from "@gitpod/gitpod-protocol";
import { Sort, SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";
import { getPrebuildLogPath } from "./prebuild-utils";
const URL = require("url").URL || window.URL;

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

        workspace.spec = this.toWorkspaceSpec(arg, workspace.spec);
        workspace.status = this.toWorkspaceStatus(arg, workspace.status);
        workspace.metadata = this.toWorkspaceMetadata(arg, workspace.metadata);
        if ("workspace" in arg) {
            workspace.id = arg.workspace.id;
            if (arg.latestInstance) {
                return this.toWorkspace(arg.latestInstance, workspace);
            }
            return workspace;
        }
        return workspace;
    }

    toWorkspaceSpec(arg: WorkspaceInfo | WorkspaceInstance, current?: WorkspaceSpec): WorkspaceSpec {
        const spec = new WorkspaceSpec(current);
        if ("workspace" in arg) {
            spec.admission = this.toAdmission(arg.workspace.shareable);
            spec.initializer = new WorkspaceInitializer(spec.initializer);
            spec.type =
                arg.workspace.type === "prebuild"
                    ? WorkspaceSpec_WorkspaceType.PREBUILD
                    : WorkspaceSpec_WorkspaceType.REGULAR;
            spec.environmentVariables = this.toEnvironmentVariables(arg.workspace.context);
            spec.initializer = this.workspaceContextToWorkspaceInitializer(arg.workspace.context);

            spec.git = new WorkspaceSpec_GitSpec({
                // TODO:
                // username: "",
                // email: "",
            });

            if (arg.latestInstance) {
                return this.toWorkspaceSpec(arg.latestInstance, spec);
            }
            return spec;
        }
        spec.editor = this.toEditor(arg.configuration?.ideConfig);
        spec.ports = this.toPorts(arg.status.exposedPorts);
        if (arg.status.timeout) {
            spec.timeout = new UpdateWorkspaceRequest_UpdateTimeout({
                disconnected: this.toDuration(arg.status.timeout),
                // TODO: inactivity
                // TODO: maximum_lifetime
            });
        }
        if (arg.workspaceClass) {
            spec.class = arg.workspaceClass;
        }
        // TODO: ssh_public_keys
        // TODO: subassembly_references
        // TODO: log_url
        return spec;
    }

    workspaceContextToWorkspaceInitializer(arg: WorkspaceContext, cloneUrl?: string): WorkspaceInitializer {
        const result = new WorkspaceInitializer();
        if (WithPrebuild.is(arg)) {
            result.specs = [
                new WorkspaceInitializer_Spec({
                    spec: {
                        case: "prebuild",
                        value: new PrebuildInitializer({
                            prebuildId: arg.prebuildWorkspaceId,
                        }),
                    },
                }),
            ];
        } else if (CommitContext.is(arg)) {
            result.specs = [
                new WorkspaceInitializer_Spec({
                    spec: {
                        case: "git",
                        value: new GitInitializer({
                            remoteUri: arg.repository.cloneUrl,
                            upstreamRemoteUri: arg.upstreamRemoteURI,
                            // TODO: more modes support
                            targetMode: GitInitializer_CloneTargetMode.REMOTE_COMMIT,
                            cloneTarget: arg.revision,
                            checkoutLocation: arg.checkoutLocation,
                            // TODO: config
                            config: new GitInitializer_GitConfig(),
                        }),
                    },
                }),
            ];
        }
        if (SnapshotContext.is(arg)) {
            result.specs = [
                new WorkspaceInitializer_Spec({
                    spec: {
                        case: "snapshot",
                        value: new SnapshotInitializer({
                            snapshotId: arg.snapshotId,
                        }),
                    },
                }),
            ];
        }
        return result;
        // TODO: else if FileDownloadInitializer
    }

    fromCreateAndStartWorkspaceRequest(
        req: CreateAndStartWorkspaceRequest,
    ): { editor?: EditorReference; contextUrl: string; workspaceClass?: string } | undefined {
        switch (req.source.case) {
            case "contextUrl": {
                if (!req.source.value.url) {
                    return undefined;
                }
                return {
                    contextUrl: req.source.value.url,
                    editor: req.source.value.editor,
                    workspaceClass: req.source.value.workspaceClass || undefined,
                };
            }
            case "spec": {
                if ((req.source.value.initializer?.specs.length ?? 0) <= 0) {
                    return undefined;
                }
                const init = req.source.value.initializer;
                const initSpec = init!.specs[0];
                let contextUrl: string | undefined;
                switch (initSpec.spec.case) {
                    case "git": {
                        if (!initSpec.spec.value.remoteUri) {
                            return undefined;
                        }
                        contextUrl = initSpec.spec.value.remoteUri;
                        break;
                    }
                    case "prebuild": {
                        if (!initSpec.spec.value || (init?.specs.length ?? 0) < 2) {
                            return undefined;
                        }
                        const gitSpec = init!.specs[1];
                        if (gitSpec.spec.case !== "git" || !gitSpec.spec.value.remoteUri) {
                            return undefined;
                        }
                        contextUrl = `open-prebuild/${initSpec.spec.value}/${gitSpec.spec.value.remoteUri}`;
                        break;
                    }
                    case "snapshot": {
                        if (!initSpec.spec.value.snapshotId) {
                            return undefined;
                        }
                        contextUrl = `snapshot/${initSpec.spec.value.snapshotId}`;
                        break;
                    }
                }
                if (!contextUrl) {
                    return undefined;
                }
                return {
                    contextUrl,
                    editor: req.source.value.editor,
                    workspaceClass: req.source.value.class || undefined,
                };
            }
        }
        return undefined;
    }

    toWorkspaceStatus(arg: WorkspaceInfo | WorkspaceInstance, current?: WorkspaceStatus): WorkspaceStatus {
        const status = new WorkspaceStatus(current);
        status.phase = new WorkspacePhase(status.phase);

        if ("workspace" in arg) {
            if (arg.workspace.type === "prebuild") {
                status.prebuildResult = new WorkspaceStatus_PrebuildResult({
                    // TODO:
                    // snapshot: "",
                    // errorMessage: "",
                });
            }
            // TODO: timeout
            status.phase.lastTransitionTime = Timestamp.fromDate(new Date(arg.workspace.creationTime));
            status.gitStatus = this.toGitStatus(arg.workspace);
            return status;
        }

        status.workspaceUrl = arg.ideUrl;
        status.conditions = this.toWorkspaceConditions(arg.status.conditions);

        let lastTransitionTime = new Date(arg.creationTime).getTime();
        if (status.phase.lastTransitionTime) {
            lastTransitionTime = Math.max(
                lastTransitionTime,
                new Date(status.phase.lastTransitionTime.toDate()).getTime(),
            );
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
        status.phase.lastTransitionTime = Timestamp.fromDate(new Date(lastTransitionTime));

        // TODO: could be improved? But by original status source producer
        status.statusVersion = status.phase.lastTransitionTime.seconds;

        status.phase.name = this.toPhase(arg);
        status.instanceId = arg.id;
        if (arg.status.message) {
            status.conditions = new WorkspaceStatus_WorkspaceConditions({
                failed: arg.status.message,
            });
            arg.status.conditions.failed;
        }
        status.gitStatus = this.toGitStatus(arg, status.gitStatus);

        return status;
    }

    toWorkspaceMetadata(arg: WorkspaceInfo | WorkspaceInstance, current?: WorkspaceMetadata): WorkspaceMetadata {
        const metadata = new WorkspaceMetadata(current);
        if ("workspace" in arg) {
            metadata.ownerId = arg.workspace.ownerId;
            metadata.configurationId = arg.workspace.projectId ?? "";
            // TODO: annotation
            metadata.organizationId = arg.workspace.organizationId;
            metadata.name = arg.workspace.description;
            metadata.pinned = arg.workspace.pinned ?? false;
            const contextUrl = ContextURL.normalize(arg.workspace);
            if (contextUrl) {
                metadata.originalContextUrl = contextUrl;
            }
        }
        return metadata;
    }

    toWorkspaceConditions(conditions: WorkspaceInstanceConditions | undefined): WorkspaceStatus_WorkspaceConditions {
        const result = new WorkspaceStatus_WorkspaceConditions({
            failed: conditions?.failed,
            timeout: conditions?.timeout,
        });
        // TODO: failedReason
        return result;
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

    toParseContextURLResponse(
        metadata: PartialMessage<WorkspaceMetadata>,
        context: WorkspaceContext,
    ): ParseContextURLResponse {
        return new ParseContextURLResponse({
            metadata,
            spec: { initializer: this.workspaceContextToWorkspaceInitializer(context) },
        });
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
            if (reason.code === ErrorCodes.BAD_REQUEST) {
                return new ConnectError(reason.message, Code.InvalidArgument, undefined, undefined, reason);
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
            if (reason.code === ErrorCodes.UNIMPLEMENTED) {
                return new ConnectError(reason.message, Code.Unimplemented, undefined, undefined, reason);
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
            if (reason.code === ErrorCodes.DEADLINE_EXCEEDED) {
                return new ConnectError(reason.message, Code.DeadlineExceeded, undefined, undefined, reason);
            }
            if (reason.code === ErrorCodes.INTERNAL_SERVER_ERROR) {
                return new ConnectError(reason.message, Code.Internal, undefined, undefined, reason);
            }
            return new ConnectError(reason.message, Code.Unknown, undefined, undefined, reason);
        }
        return new ConnectError(`Oops! Something went wrong.`, Code.Internal, undefined, undefined, reason);
    }

    fromError(reason: ConnectError): ApplicationError {
        if (reason.code === Code.InvalidArgument) {
            return new ApplicationError(ErrorCodes.BAD_REQUEST, reason.rawMessage);
        }
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
        if (reason.code === Code.Unimplemented) {
            return new ApplicationError(ErrorCodes.UNIMPLEMENTED, reason.rawMessage);
        }
        if (reason.code === Code.ResourceExhausted) {
            return new ApplicationError(ErrorCodes.TOO_MANY_REQUESTS, reason.rawMessage);
        }
        if (reason.code === Code.Canceled) {
            return new ApplicationError(ErrorCodes.CANCELLED, reason.rawMessage);
        }
        if (reason.code === Code.DeadlineExceeded) {
            return new ApplicationError(ErrorCodes.DEADLINE_EXCEEDED, reason.rawMessage);
        }
        if (reason.code === Code.Internal) {
            return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, reason.rawMessage);
        }
        return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, reason.rawMessage);
    }

    toEnvironmentVariables(context: WorkspaceContext): EnvironmentVariable[] {
        if (WithEnvvarsContext.is(context)) {
            return context.envvars.map((envvar) => this.toWorkspaceEnvironmentVariable(envvar));
        }
        return [];
    }

    toWorkspaceEnvironmentVariable(envVar: EnvVarWithValue): EnvironmentVariable {
        const result = new EnvironmentVariable();
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
        result.admission = this.toAdmission(port.visibility === "public");
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
                // TODO:
                // case "pause":
                //     return WorkspacePhase_Phase.PAUSED;
                case "stopping":
                    return WorkspacePhase_Phase.STOPPING;
                case "stopped":
                    return WorkspacePhase_Phase.STOPPED;
            }
        }
        return WorkspacePhase_Phase.UNSPECIFIED;
    }

    fromPhase(arg: WorkspacePhase_Phase): WorkspaceInstancePhase {
        switch (arg) {
            case WorkspacePhase_Phase.UNSPECIFIED:
                return "unknown";
            case WorkspacePhase_Phase.PREPARING:
                return "preparing";
            case WorkspacePhase_Phase.IMAGEBUILD:
                return "building";
            case WorkspacePhase_Phase.PENDING:
                return "pending";
            case WorkspacePhase_Phase.CREATING:
                return "creating";
            case WorkspacePhase_Phase.INITIALIZING:
                return "initializing";
            case WorkspacePhase_Phase.RUNNING:
                return "running";
            case WorkspacePhase_Phase.INTERRUPTED:
                return "interrupted";
            // TODO:
            // case WorkspacePhase_Phase.PAUSED:
            //     return "unknown";
            case WorkspacePhase_Phase.STOPPING:
                return "stopping";
            case WorkspacePhase_Phase.STOPPED:
                return "stopped";
        }
        return "unknown";
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

    fromSort(sort: Sort) {
        return {
            order: this.fromSortOrder(sort.order),
            field: sort.field,
        } as const;
    }

    fromSortOrder(order: SortOrder) {
        switch (order) {
            case SortOrder.ASC:
                return "ASC";
            case SortOrder.DESC:
                return "DESC";
            default:
                return undefined;
        }
    }

    toOrgMemberRole(role: OrgMemberRole): OrganizationRole {
        switch (role) {
            case "owner":
                return OrganizationRole.OWNER;
            case "member":
                return OrganizationRole.MEMBER;
            case "collaborator":
                return OrganizationRole.COLLABORATOR;
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
            case OrganizationRole.COLLABORATOR:
                return "collaborator";
            default:
                throw new Error(`unknown org member role ${role}`);
        }
    }

    fromWorkspaceSettings(settings?: DeepPartial<WorkspaceSettings>) {
        const result: Partial<
            Pick<ProjectSettings, "workspaceClasses" | "restrictedWorkspaceClasses" | "restrictedEditorNames">
        > = {};
        if (settings?.workspaceClass) {
            result.workspaceClasses = {
                regular: settings.workspaceClass,
            };
        }

        if (settings?.restrictedWorkspaceClasses) {
            result.restrictedWorkspaceClasses = settings.restrictedWorkspaceClasses.filter((e) => !!e) as string[];
        }

        if (settings?.restrictedEditorNames) {
            result.restrictedEditorNames = settings.restrictedEditorNames.filter((e) => !!e) as string[];
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
        const { workspaceClasses, restrictedWorkspaceClasses, restrictedEditorNames } = this.fromWorkspaceSettings(
            configuration.workspaceSettings,
        );

        const result: PartialProject = {
            id: configuration.id,
            settings: {},
        };

        if (configuration.name !== undefined) {
            result.name = configuration.name;
        }

        if (Object.keys(prebuilds).length > 0) {
            result.settings!.prebuilds = prebuilds;
        }
        if (workspaceClasses && Object.keys(workspaceClasses).length > 0) {
            result.settings!.workspaceClasses = workspaceClasses;
        }
        if (restrictedWorkspaceClasses) {
            result.settings!.restrictedWorkspaceClasses = restrictedWorkspaceClasses;
        }
        if (restrictedEditorNames) {
            result.settings!.restrictedEditorNames = restrictedEditorNames;
        }

        return result;
    }

    toOrganizationSettings(settings: OrganizationSettingsProtocol): OrganizationSettings {
        return new OrganizationSettings({
            workspaceSharingDisabled: !!settings.workspaceSharingDisabled,
            defaultWorkspaceImage: settings.defaultWorkspaceImage || undefined,
            allowedWorkspaceClasses: settings.allowedWorkspaceClasses || [],
            pinnedEditorVersions: settings.pinnedEditorVersions || {},
            restrictedEditorNames: settings.restrictedEditorNames || [],
            defaultRole: settings.defaultRole || undefined,
        });
    }

    toConfiguration(project: Project): Configuration {
        const result = new Configuration();
        result.id = project.id;
        result.organizationId = project.teamId;
        result.name = project.name;
        result.cloneUrl = project.cloneUrl;
        result.creationTime = Timestamp.fromDate(new Date(project.creationTime));
        result.workspaceSettings = this.toWorkspaceSettings(project.settings);
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

    toWorkspaceSettings(projectSettings: ProjectSettings | undefined): WorkspaceSettings {
        const result = new WorkspaceSettings();
        if (projectSettings?.workspaceClasses?.regular) {
            result.workspaceClass = projectSettings.workspaceClasses.regular;
        }
        if (projectSettings?.restrictedWorkspaceClasses) {
            result.restrictedWorkspaceClasses = projectSettings.restrictedWorkspaceClasses;
        }
        if (projectSettings?.restrictedEditorNames) {
            result.restrictedEditorNames = projectSettings.restrictedEditorNames;
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

    toPrebuilds(gitpodHost: string, prebuilds: PrebuildWithStatus[]): Prebuild[] {
        return prebuilds.map((prebuild) => this.toPrebuild(gitpodHost, prebuild));
    }

    toPrebuild(gitpodHost: string, prebuild: PrebuildWithStatus): Prebuild {
        return new Prebuild({
            id: prebuild.info.id,
            workspaceId: prebuild.info.buildWorkspaceId,

            basedOnPrebuildId: prebuild.info.basedOnPrebuildId,

            configurationId: prebuild.info.projectId,
            configurationName: prebuild.info.projectName,
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

            status: this.toPrebuildStatus(gitpodHost, prebuild),
        });
    }

    toPrebuildStatus(gitpodHost: string, prebuild: PrebuildWithStatus): PrebuildStatus {
        return new PrebuildStatus({
            phase: new PrebuildPhase({
                name: this.toPrebuildPhase(prebuild.status),
            }),
            startTime: Timestamp.fromDate(new Date(prebuild.info.startedAt)),
            message: prebuild.error,
            logUrl: new URL(getPrebuildLogPath(prebuild.info.id), gitpodHost).toString(),
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

    fromPrebuildFilterState(state: PrebuildFilterState) {
        switch (state) {
            case PrebuildFilterState.SUCCEEDED:
                return "succeeded";
            case PrebuildFilterState.FAILED:
                return "failed";
            case PrebuildFilterState.UNFINISHED:
                return "unfinished";
        }
        return undefined;
    }

    toBlockedRepository(repo: ProtocolBlockedRepository): BlockedRepository {
        return new BlockedRepository({
            id: repo.id,
            urlRegexp: repo.urlRegexp,
            blockUser: repo.blockUser,
            blockFreeUsage: repo.blockFreeUsage,
            creationTime: Timestamp.fromDate(new Date(repo.createdAt)),
            updateTime: Timestamp.fromDate(new Date(repo.updatedAt)),
        });
    }

    toBlockedEmailDomain(item: EmailDomainFilterEntry): BlockedEmailDomain {
        return new BlockedEmailDomain({
            id: "",
            domain: item.domain,
            negative: item.negative,
        });
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

    /**
     * Converts a duration to a string like "1h2m3s4ms"
     *
     * `Duration.nanos` is ignored
     * @returns a string like "1h2m3s", valid time units are `s`, `m`, `h`
     */
    toDurationString(duration?: PartialMessage<Duration>): string {
        const seconds = duration?.seconds || 0;
        if (seconds === 0) {
            return "";
        }
        const totalMilliseconds = Number(seconds) * 1000;

        const hours = Math.floor(totalMilliseconds / 3600000);
        const remainingMillisecondsAfterHours = totalMilliseconds % 3600000;
        const minutes = Math.floor(remainingMillisecondsAfterHours / 60000);
        const remainingMillisecondsAfterMinutes = remainingMillisecondsAfterHours % 60000;
        const secondsResult = Math.floor(remainingMillisecondsAfterMinutes / 1000);

        return `${hours > 0 ? hours + "h" : ""}${minutes > 0 ? minutes + "m" : ""}${
            secondsResult > 0 ? secondsResult + "s" : ""
        }`;
    }

    toUser(from: UserProtocol): User {
        const {
            id,
            name,
            fullName,
            creationDate,
            identities,
            additionalData,
            avatarUrl,
            featureFlags,
            organizationId,
            rolesOrPermissions,
            usageAttributionId,
            blocked,
            lastVerificationTime,
            verificationPhoneNumber,
        } = from;
        const {
            disabledClosedTimeout,
            dotfileRepo,
            emailNotificationSettings,
            ideSettings,
            profile,
            workspaceAutostartOptions,
            workspaceClasses,
            workspaceTimeout,
        } = additionalData || {};

        return new User({
            id,
            name: fullName || name,
            createdAt: this.toTimestamp(creationDate),
            avatarUrl,
            organizationId,
            usageAttributionId,
            blocked,
            identities: identities?.map((i) => this.toIdentity(i)),
            rolesOrPermissions: rolesOrPermissions?.map((rp) => this.toRoleOrPermission(rp)),
            workspaceFeatureFlags: featureFlags?.permanentWSFeatureFlags?.map((ff) => this.toUserFeatureFlags(ff)),
            workspaceTimeoutSettings: new User_WorkspaceTimeoutSettings({
                inactivity: !!workspaceTimeout ? this.toDuration(workspaceTimeout) : undefined,
                disabledDisconnected: disabledClosedTimeout,
            }),
            dotfileRepo,
            emailNotificationSettings: new User_EmailNotificationSettings({
                allowsChangelogMail: emailNotificationSettings?.allowsChangelogMail,
                allowsDevxMail: emailNotificationSettings?.allowsDevXMail,
                allowsOnboardingMail: emailNotificationSettings?.allowsOnboardingMail,
            }),
            editorSettings: this.toEditorReference(ideSettings),
            lastVerificationTime: this.toTimestamp(lastVerificationTime),
            verificationPhoneNumber,
            workspaceClass: workspaceClasses?.regular,
            workspaceAutostartOptions: workspaceAutostartOptions?.map((o) => this.toWorkspaceAutostartOption(o)),
            profile,
        });
    }

    /**
     * Converts a duration string like "1h2m3s" to a Duration
     *
     * @param durationString "1h2m3s" valid time units are `s`, `m`, `h`
     */
    toDuration(from: string): Duration {
        const millis = parseGoDurationToMs(from);
        const seconds = BigInt(Math.floor(millis / 1000));
        const nanos = (millis % 1000) * 1000000;
        return new Duration({
            seconds,
            nanos,
        });
    }

    toWorkspaceClass(cls: SupportedWorkspaceClass): WorkspaceClass {
        return new WorkspaceClass({
            id: cls.id,
            displayName: cls.displayName,
            description: cls.description,
            isDefault: cls.isDefault,
        });
    }

    toTimestamp(from?: string | undefined): Timestamp | undefined {
        return from ? Timestamp.fromDate(new Date(from)) : undefined;
    }

    toIdentity(from: IdentityProtocol): Identity {
        const { authId, authName, authProviderId, lastSigninTime, primaryEmail } = from;
        return new Identity({
            authProviderId,
            authId,
            authName,
            lastSigninTime: this.toTimestamp(lastSigninTime),
            primaryEmail,
        });
    }

    toRoleOrPermission(from: ProtocolRoleOrPermission): RoleOrPermission {
        switch (from) {
            case "admin":
                return RoleOrPermission.ADMIN;
            case "devops":
                return RoleOrPermission.DEVOPS;
            case "viewer":
                return RoleOrPermission.VIEWER;
            case "developer":
                return RoleOrPermission.DEVELOPER;
            case "registry-access":
                return RoleOrPermission.REGISTRY_ACCESS;
            case "admin-permissions":
                return RoleOrPermission.ADMIN_PERMISSIONS;
            case "admin-users":
                return RoleOrPermission.ADMIN_USERS;
            case "admin-workspace-content":
                return RoleOrPermission.ADMIN_WORKSPACE_CONTENT;
            case "admin-workspaces":
                return RoleOrPermission.ADMIN_WORKSPACES;
            case "admin-projects":
                return RoleOrPermission.ADMIN_PROJECTS;
            case "new-workspace-cluster":
                return RoleOrPermission.NEW_WORKSPACE_CLUSTER;
        }
        return RoleOrPermission.UNSPECIFIED;
    }

    toUserFeatureFlags(from: NamedWorkspaceFeatureFlag): User_UserFeatureFlag {
        switch (from) {
            case "full_workspace_backup":
                return User_UserFeatureFlag.FULL_WORKSPACE_BACKUP;
            case "workspace_class_limiting":
                return User_UserFeatureFlag.WORKSPACE_CLASS_LIMITING;
            case "workspace_connection_limiting":
                return User_UserFeatureFlag.WORKSPACE_CONNECTION_LIMITING;
            case "workspace_psi":
                return User_UserFeatureFlag.WORKSPACE_PSI;
        }
        return User_UserFeatureFlag.UNSPECIFIED;
    }

    toEditorReference(from?: IDESettings): EditorReference | undefined {
        if (!from) {
            return undefined;
        }
        return new EditorReference({
            name: from.defaultIde,
            version: from.useLatestVersion ? "latest" : "stable",
        });
    }

    fromEditorReference(e?: EditorReference): IDESettings | undefined {
        if (!e) {
            return undefined;
        }
        return {
            defaultIde: e.name,
            useLatestVersion: e.version === "latest",
        };
    }

    toWorkspaceAutostartOption(from: WorkspaceAutostartOption): User_WorkspaceAutostartOption {
        return new User_WorkspaceAutostartOption({
            cloneUrl: from.cloneURL,
            editorSettings: this.toEditorReference(from.ideSettings),
            organizationId: from.organizationId,
            region: from.region,
            workspaceClass: from.workspaceClass,
        });
    }

    fromWorkspaceAutostartOption(
        o: User_WorkspaceAutostartOption | SetWorkspaceAutoStartOptionsRequest_WorkspaceAutostartOption,
    ): WorkspaceAutostartOption {
        const region = !!o.region && isWorkspaceRegion(o.region) ? o.region : "";
        return {
            cloneURL: o.cloneUrl,
            ideSettings: this.fromEditorReference(o.editorSettings),
            organizationId: o.organizationId,
            region,
            workspaceClass: o.workspaceClass,
        };
    }

    toWorkspaceSnapshot(
        snapshot: Pick<Snapshot, "id" | "originalWorkspaceId"> & Partial<Pick<Snapshot, "creationTime">>,
    ): WorkspaceSnapshot {
        return new WorkspaceSnapshot({
            id: snapshot.id,
            workspaceId: snapshot.originalWorkspaceId,
            creationTime: snapshot.creationTime ? this.toTimestamp(snapshot.creationTime) : undefined,
        });
    }

    toOnboardingState(state: GitpodServer.OnboardingState): OnboardingState {
        return new OnboardingState({
            completed: state.isCompleted,
        });
    }
}

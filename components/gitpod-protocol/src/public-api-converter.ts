/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError } from "@connectrpc/connect";
import { Timestamp } from "@bufbuild/protobuf";
import {
    AdmissionLevel,
    EditorReference,
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
import {
    Organization,
    OrganizationMember,
    OrganizationRole,
    OrganizationSettings,
} from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import {
    BranchMatchingStrategy,
    Configuration,
    PrebuildSettings,
    WorkspaceSettings,
} from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { ApplicationError, ErrorCode, ErrorCodes } from "./messaging/error";
import {
    CommitContext,
    EnvVarWithValue,
    WithEnvvarsContext,
    WithPrebuild,
    WorkspaceContext,
    WorkspaceInfo,
    Workspace as ProtocolWorkspace,
} from "./protocol";
import {
    ConfigurationIdeConfig,
    PortProtocol,
    WorkspaceInstance,
    WorkspaceInstanceConditions,
    WorkspaceInstancePort,
} from "./workspace-instance";
import { ContextURL } from "./context-url";
import { TrustedValue } from "./util/scrubbing";
import {
    Organization as ProtocolOrganization,
    OrgMemberInfo,
    OrgMemberRole,
    OrganizationSettings as OrganizationSettingsProtocol,
    Project,
    PrebuildSettings as PrebuildSettingsProtocol,
} from "./teams-projects-protocol";

const applicationErrorCode = "application-error-code";
const applicationErrorData = "application-error-data";

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
            workspace.additionalEnvironmentVariables = this.toEnvironmentVariables(arg.workspace.context);

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
        status.message = arg.status.message;
        status.workspaceUrl = arg.ideUrl;
        status.ports = this.toPorts(arg.status.exposedPorts);
        status.conditions = this.toWorkspaceConditions(arg.status.conditions);
        status.gitStatus = this.toGitStatus(arg, status.gitStatus);
        workspace.region = arg.region;
        workspace.workspaceClass = arg.workspaceClass;
        workspace.editor = this.toEditor(arg.configuration.ideConfig);

        return workspace;
    }

    toWorkspaceConditions(conditions: WorkspaceInstanceConditions): WorkspaceConditions {
        const result = new WorkspaceConditions();
        result.failed = conditions.failed;
        result.timeout = conditions.timeout;
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

    toError(reason: unknown): ConnectError {
        if (reason instanceof ConnectError) {
            return reason;
        }
        if (reason instanceof ApplicationError) {
            const metadata: HeadersInit = {};
            metadata[applicationErrorCode] = String(reason.code);
            if (reason.data) {
                metadata[applicationErrorData] = JSON.stringify(reason.data);
            }
            if (reason.code === ErrorCodes.NOT_FOUND) {
                return new ConnectError(reason.message, Code.NotFound, metadata, undefined, reason);
            }
            if (reason.code === ErrorCodes.NOT_AUTHENTICATED) {
                return new ConnectError(reason.message, Code.Unauthenticated, metadata, undefined, reason);
            }
            if (reason.code === ErrorCodes.PERMISSION_DENIED || reason.code === ErrorCodes.USER_BLOCKED) {
                return new ConnectError(reason.message, Code.PermissionDenied, metadata, undefined, reason);
            }
            if (reason.code === ErrorCodes.CONFLICT) {
                return new ConnectError(reason.message, Code.AlreadyExists, metadata, undefined, reason);
            }
            if (reason.code === ErrorCodes.PRECONDITION_FAILED) {
                return new ConnectError(reason.message, Code.FailedPrecondition, metadata, undefined, reason);
            }
            if (reason.code === ErrorCodes.TOO_MANY_REQUESTS) {
                return new ConnectError(reason.message, Code.ResourceExhausted, metadata, undefined, reason);
            }
            if (reason.code === ErrorCodes.INTERNAL_SERVER_ERROR) {
                return new ConnectError(reason.message, Code.Internal, metadata, undefined, reason);
            }
            return new ConnectError(reason.message, Code.InvalidArgument, metadata, undefined, reason);
        }
        return ConnectError.from(reason, Code.Internal);
    }

    fromError(reason: ConnectError): Error {
        const codeMetadata = reason.metadata?.get(applicationErrorCode);
        if (!codeMetadata) {
            return reason;
        }
        const code = Number(codeMetadata) as ErrorCode;
        const dataMetadata = reason.metadata?.get(applicationErrorData);
        let data = undefined;
        if (dataMetadata) {
            try {
                data = JSON.parse(dataMetadata);
            } catch (e) {
                console.error("failed to parse application error data", e);
            }
        }
        // data is trusted here, since it was scrubbed before on the server
        return new ApplicationError(code, reason.message, new TrustedValue(data));
    }

    toEnvironmentVariables(context: WorkspaceContext): WorkspaceEnvironmentVariable[] {
        if (WithEnvvarsContext.is(context)) {
            return context.envvars.map((envvar) => this.toEnvironmentVariable(envvar));
        }
        return [];
    }

    toEnvironmentVariable(envVar: EnvVarWithValue): WorkspaceEnvironmentVariable {
        const result = new WorkspaceEnvironmentVariable();
        result.name = envVar.name;
        envVar.value = envVar.value;
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
        const result = new OrganizationMember();
        result.userId = member.userId;
        result.fullName = member.fullName;
        result.email = member.primaryEmail;
        result.avatarUrl = member.avatarUrl;
        result.role = this.toOrgMemberRole(member.role);
        result.memberSince = Timestamp.fromDate(new Date(member.memberSince));
        result.ownedByOrganization = member.ownedByOrganization;
        return result;
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

    toOrganizationSettings(settings: OrganizationSettingsProtocol): OrganizationSettings {
        const result = new OrganizationSettings();
        result.workspaceSharingDisabled = !!settings.workspaceSharingDisabled;
        result.defaultWorkspaceImage = settings.defaultWorkspaceImage || undefined;
        return result;
    }

    toConfiguration(project: Project): Configuration {
        const result = new Configuration();
        result.id = project.id;
        result.organizationId = project.teamId;
        result.name = project.name;
        result.cloneUrl = project.cloneUrl;
        result.workspaceSettings = this.toWorkspaceSettings(project.settings?.workspaceClasses?.regular);
        result.prebuildSettings = this.toPrebuildSettings(project.settings?.prebuilds);
        return result;
    }

    toPrebuildSettings(prebuilds: PrebuildSettingsProtocol | undefined): PrebuildSettings {
        const result = new PrebuildSettings();
        if (prebuilds) {
            result.enabled = prebuilds.enable;
            result.branchMatchingPattern = prebuilds.branchMatchingPattern;
            result.branchStrategy = this.toBranchMatchingStrategy(prebuilds.branchStrategy);
            result.prebuildInterval = prebuilds.prebuildInterval;
            result.workspaceClass = prebuilds.workspaceClass;
        }
        return result;
    }

    toBranchMatchingStrategy(
        branchStrategy?: PrebuildSettingsProtocol.BranchStrategy,
    ): BranchMatchingStrategy | undefined {
        switch (branchStrategy) {
            case "default-branch":
                return BranchMatchingStrategy.DEFAULT_BRANCH;
            case "all-branches":
                return BranchMatchingStrategy.ALL_BRANCHES;
            case "matched-branches":
                return BranchMatchingStrategy.MATCHED_BRANCHES;
        }
        return undefined;
    }

    toWorkspaceSettings(workspaceClass: string | undefined): WorkspaceSettings {
        const result = new WorkspaceSettings();
        if (workspaceClass) {
            result.workspaceClass = workspaceClass;
        }
        return result;
    }
}

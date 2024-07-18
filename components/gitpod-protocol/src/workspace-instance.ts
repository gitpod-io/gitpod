/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { EnvVar, NamedWorkspaceFeatureFlag, TaskConfig } from "./protocol";
import { WorkspaceRegion } from "./workspace-cluster";

// WorkspaceInstance describes a part of a workspace's lifetime, specifically a single running session of it
export interface WorkspaceInstance {
    // ID is the unique identifier of this instance
    id: string;

    // workspaceId is the unique identifier of the workspace this is an instance of
    workspaceId: string;

    // The time an instance has been created in the backend (before DB!)
    creationTime: string;

    // The time an instance has switched phase to 'Pending'
    deployedTime?: string;

    // The time an instance has switched phase to 'Running'
    startedTime?: string;

    // The time an instance has switched phase to 'Stopping' */
    stoppingTime?: string;

    // The time an instance has switched phase to 'Stopped' */
    stoppedTime?: string;

    // ideUrl is the URL at which the workspace is available on the internet
    // Note: this is initially empty, filled during starting process!
    ideUrl: string;

    // region is the name of the workspace cluster this instance runs in
    // Note: this is initially empty, filled during starting process!
    region: string;

    // workspaceImage is the name of the Docker image this instance runs
    // Note: this is initially empty, filled during starting process!
    workspaceImage: string;

    // status is the latest status of the instance that we're aware of
    status: WorkspaceInstanceStatus;

    // repo contains information about the Git working copy inside the workspace
    gitStatus?: WorkspaceInstanceRepoStatus;

    // configuration captures the per-instance configuration variance of a workspace
    configuration: WorkspaceInstanceConfiguration;

    // instance is hard-deleted on the database and about to be collected by periodic deleter
    readonly deleted?: boolean;

    /**
     * Contains information about the image build, if there was any
     */
    imageBuildInfo?: ImageBuildInfo;

    /**
     * workspace class, also known as workspace size, determines the type of
     * resources that are provided to the workspace.
     */
    workspaceClass?: string;

    /**
     * Identifies the team or user to which this instance's runtime should be attributed to
     * (e.g. for usage analytics or billing purposes).
     */
    usageAttributionId?: string;
}

// WorkspaceInstanceStatus describes the current state of a workspace instance
export interface WorkspaceInstanceStatus {
    // version is the current version of the workspace instance status
    // Note: consider this value opague. The only guarantee given is that it imposes
    //       a partial order on status updates, i.e. a.version > b.version -> a newer than b.
    version?: number;

    // phase describes a high-level state of the workspace instance
    phase: WorkspaceInstancePhase;

    // conditions further specify the phase
    conditions: WorkspaceInstanceConditions;

    // message is a user-readable message containing information about the workspace
    message?: string;

    // exposedPorts is the list of currently exposed ports
    exposedPorts?: WorkspaceInstancePort[];

    // timeout is a non-default timeout value configured for a workspace
    timeout?: string;

    // nodeName is the name of the node the instance was scheduled onto
    nodeName?: string;

    // podName is the name of the pod of this instance
    podName?: string;

    // nodeIp is the IP of the node the workspace is running on
    nodeIp?: string;

    // ownerToken is the token one needs to access the workspace. Its presence is checked by ws-proxy.
    ownerToken?: string;
}

// WorkspaceInstancePhase describes a high-level state of a workspace instance
export type WorkspaceInstancePhase =
    // unknown indicates an issue within the system in that it cannot determine the actual phase of
    // a workspace. This phase is usually accompanied by an error.
    | "unknown"

    // Preparing means that we haven't actually started the workspace instance just yet, but rather
    // are still preparing for launch.
    | "preparing"

    // Building means that we are building the Docker image for the workspace. A workspace will enter this phase only
    // if an image build is required for that workspace.
    | "building"

    // Pending means the workspace does not yet consume resources in the cluster, but rather is looking for
    // some space within the cluster. If for example the cluster needs to scale up to accomodate the
    // workspace, the workspace will be in Pending state until that happened.
    | "pending"

    // Creating means the workspace is currently being created. Thati includes downloading the images required
    // to run the workspace over the network. The time spent in this phase varies widely and depends on the current
    // network speed, image size and cache states.
    | "creating"

    // Initializing is the phase in which the workspace is executing the appropriate workspace initializer (e.g. Git
    // clone or backup download). After this phase one can expect the workspace to either be Running or Failed.
    | "initializing"

    // Running means the workspace is able to actively perform work, either by serving a user through Theia,
    // or as a headless workspace.
    | "running"

    // Interrupted is an exceptional state where the container should be running but is temporarily unavailable.
    // When in this state, we expect it to become running or stopping anytime soon.
    | "interrupted"

    // Stopping means that the workspace is currently shutting down. It could go to stopped every moment.
    | "stopping"

    // Stopped means the workspace ended regularly because it was shut down.
    | "stopped";

export interface WorkspaceInstanceConditions {
    // Failed contains the reason the workspace failed to operate. If this field is empty, the workspace has not failed.
    // failed contains technical details for the failure of the workspace.
    failed?: string;

    // timeout contains the reason the workspace has timed out. If this field is empty, the workspace has not timed out.
    timeout?: string;

    // PullingImages marks if the workspace is currently pulling its images. This condition can only be set during PhaseCreating
    pullingImages?: boolean;

    // deployed marks that a workspace instance was sent/deployed at a workspace manager
    deployed?: boolean;

    // Whether the workspace start triggered an image build
    neededImageBuild?: boolean;

    // ISO8601 timestamp when the first user activity was registered in the frontend. Only set if the workspace is running.
    firstUserActivity?: string;

    // headlessTaskFailed indicates that a headless workspace task failed
    // headlessTaskFailed is only set if:
    //  * this workspace is headless
    //  * the task being run returned a non 0 exit status code
    headlessTaskFailed?: string;

    // stopped_by_request is true if the workspace was stopped using a StopWorkspace call
    stoppedByRequest?: boolean;
}

// AdmissionLevel describes who can access a workspace instance and its ports.
export type AdmissionLevel = "owner_only" | "everyone";

// PortVisibility describes how a port can be accessed
export type PortVisibility = "public" | "private";

// PortProtocol
export type PortProtocol = "http" | "https";

// WorkspaceInstancePort describes a port exposed on a workspace instance
export interface WorkspaceInstancePort {
    // The outward-facing port number
    port: number;

    // The visiblity of this port. Optional for backwards compatibility.
    visibility?: PortVisibility;

    // Public, outward-facing URL where the port can be accessed on.
    url?: string;

    protocol?: PortProtocol;
}

// WorkspaceInstanceRepoStatus describes the status of th Git working copy of a workspace
export interface WorkspaceInstanceRepoStatus {
    // branch is branch we're currently on
    branch?: string;

    // latestCommit is the last commit on the current branch
    latestCommit?: string;

    // uncommitedFiles is list of uncommitted files, possibly truncated
    uncommitedFiles?: string[];

    // the total number of uncommited files
    totalUncommitedFiles?: number;

    // untrackedFiles is the list of untracked files in the workspace, possibly truncated
    untrackedFiles?: string[];

    // the total number of untracked files
    totalUntrackedFiles?: number;

    // unpushedCommits is the list of unpushed changes in the workspace, possibly truncated
    unpushedCommits?: string[];

    // the total number of unpushed changes
    totalUnpushedCommits?: number;
}
export namespace WorkspaceInstanceRepoStatus {
    export function equals(
        a: WorkspaceInstanceRepoStatus | undefined,
        b: WorkspaceInstanceRepoStatus | undefined,
    ): boolean {
        if (!a && !b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return (
            a.branch === b.branch &&
            a.latestCommit === b.latestCommit &&
            a.totalUncommitedFiles === b.totalUncommitedFiles &&
            a.totalUnpushedCommits === b.totalUnpushedCommits &&
            a.totalUntrackedFiles === b.totalUntrackedFiles &&
            stringArrayEquals(a.uncommitedFiles, b.uncommitedFiles) &&
            stringArrayEquals(a.untrackedFiles, b.untrackedFiles) &&
            stringArrayEquals(a.unpushedCommits, b.unpushedCommits)
        );
    }
    function stringArrayEquals(a: string[] | undefined, b: string[] | undefined): boolean {
        if (a === undefined && b === undefined) return true;

        if (a === undefined || b === undefined) return false;

        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }

        return true;
    }
}

// ConfigurationIdeConfig ide config of WorkspaceInstanceConfiguration
export interface ConfigurationIdeConfig {
    useLatest?: boolean;
    ide?: string;
    preferToolbox?: boolean;
}

export interface IdeSetup {
    tasks?: TaskConfig[];
    envvars?: EnvVar[];
}

// WorkspaceInstanceConfiguration contains all per-instance configuration
export interface WorkspaceInstanceConfiguration {
    // theiaVersion is the version of Theia this workspace instance uses
    // @deprected: replaced with the ideImage field
    theiaVersion?: string;

    // feature flags are the lowercase feature-flag names as passed to ws-manager
    featureFlags?: NamedWorkspaceFeatureFlag[];

    // ideImage is the ref of the IDE image this instance uses.
    ideImage: string;

    // ideImageLayers are images needed for the ide to run,
    // including ide-desktop, desktop-plugin and so on
    ideImageLayers?: string[];

    // supervisorImage is the ref of the supervisor image this instance uses.
    supervisorImage?: string;

    // ideSetup contains all piece that are necessary to get the IDE running
    // TODO(gpl) ideally also contains the fields above: ideImage, ideImageLayers and supervisorImage
    ideSetup?: IdeSetup;

    // ideConfig contains user-controlled IDE configuration
    ideConfig?: ConfigurationIdeConfig;

    // The region the user passed as a preference for this workspace
    regionPreference?: WorkspaceRegion;

    // Whether this instance is started from a backup
    fromBackup?: boolean;
}

/**
 * Holds information about the image build (if there was one) for this WorkspaceInstance
 */
export interface ImageBuildInfo {
    log?: ImageBuildLogInfo;
}

/**
 * Holds information about how to access logs for this an image build
 */
export interface ImageBuildLogInfo {
    url: string;
    headers: { [key: string]: string };
}

/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { PauseCircle, LucideProps, Clock, CircleSlash, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import type { ForwardRefExoticComponent } from "react";

import StatusDone from "../icons/StatusDone.svg";
import StatusFailed from "../icons/StatusFailed.svg";
import StatusCanceled from "../icons/StatusCanceled.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";

export const prebuildDisplayProps = (prebuild: Prebuild): { className: string; label: string } => {
    switch (prebuild.status?.phase?.name) {
        case PrebuildPhase_Phase.UNSPECIFIED: // Fall through
        case PrebuildPhase_Phase.QUEUED:
            return { className: "text-orange-500", label: "pending" };
        case PrebuildPhase_Phase.BUILDING:
            return { className: "text-blue-500", label: "running" };
        case PrebuildPhase_Phase.ABORTED:
            return { className: "text-gray-500", label: "cancelled" };
        case PrebuildPhase_Phase.FAILED:
            return { className: "text-red-500", label: "error" };
        case PrebuildPhase_Phase.TIMEOUT:
            return { className: "text-red-500", label: "timeout" };
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild.status?.message) {
                return { className: "text-red-500", label: "failed" };
            }
            return { className: "text-green-500", label: "ready" };
    }

    return { className: "", label: "" };
};

export const prebuildStatusLabel = (prebuild: Prebuild): JSX.Element => {
    const { className, label } = prebuildDisplayProps(prebuild);
    return <span className={`font-medium ${className} uppercase`}>{label}</span>;
};

export const prebuildStatusIconName = (prebuild: Prebuild): ForwardRefExoticComponent<LucideProps> => {
    switch (prebuild.status?.phase?.name) {
        case PrebuildPhase_Phase.UNSPECIFIED: // Fall through
        case PrebuildPhase_Phase.QUEUED:
            return PauseCircle;
        case PrebuildPhase_Phase.BUILDING:
            return Clock;
        case PrebuildPhase_Phase.ABORTED:
            return CircleSlash;
        case PrebuildPhase_Phase.TIMEOUT:
        case PrebuildPhase_Phase.FAILED:
            return XCircle;
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild?.status?.message) {
                return XCircle;
            }
            return CheckCircle2;
    }

    return HelpCircle;
};

export const prebuildStatusIcon = (prebuild?: Prebuild) => {
    switch (prebuild?.status?.phase?.name) {
        case PrebuildPhase_Phase.UNSPECIFIED: // Fall through
        case PrebuildPhase_Phase.QUEUED:
            return <img alt="" className="h-4 w-4" src={StatusPaused} />;
        case PrebuildPhase_Phase.BUILDING:
            return <img alt="" className="h-4 w-4" src={StatusRunning} />;
        case PrebuildPhase_Phase.ABORTED:
            return <img alt="" className="h-4 w-4" src={StatusCanceled} />;
        case PrebuildPhase_Phase.FAILED:
            return <img alt="" className="h-4 w-4" src={StatusFailed} />;
        case PrebuildPhase_Phase.TIMEOUT:
            return <img alt="" className="h-4 w-4" src={StatusFailed} />;
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild?.status?.message) {
                return <img alt="" className="h-4 w-4" src={StatusFailed} />;
            }
            return <img alt="" className="h-4 w-4" src={StatusDone} />;
    }
};

export const getPrebuildStatusDescription = (prebuild: Prebuild): string => {
    switch (prebuild.status?.phase?.name) {
        case PrebuildPhase_Phase.QUEUED:
            return `Prebuild is queued and will be processed when there is execution capacity.`;
        case PrebuildPhase_Phase.BUILDING:
            return `Prebuild is currently in progress.`;
        case PrebuildPhase_Phase.ABORTED:
            return `Prebuild has been cancelled. Either a newer commit was pushed to the same branch, a user cancelled it manually, or the prebuild rate limit has been exceeded. ${
                prebuild.status?.message || ""
            }`;
        case PrebuildPhase_Phase.FAILED:
            return `Prebuild failed for system reasons. Please contact support. ${prebuild.status?.message || ""}`;
        case PrebuildPhase_Phase.TIMEOUT:
            return `Prebuild timed out. Either the image, or the prebuild tasks took too long. ${
                prebuild.status?.message || ""
            }`;
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild.status?.message) {
                return `The tasks executed in the prebuild returned a non-zero exit code. ${prebuild.status.message}`;
            }
            return `Prebuild completed successfully.`;
        default:
            return `Unknown prebuild status.`;
    }
};

/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { PauseCircle, LucideProps, Clock, CheckCircle2, XCircle, Loader2Icon } from "lucide-react";
import type { ForwardRefExoticComponent } from "react";
import { cn } from "@podkit/lib/cn";

import StatusDone from "../icons/StatusDone.svg";
import StatusFailed from "../icons/StatusFailed.svg";
import StatusCanceled from "../icons/StatusCanceled.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";

export function PrebuildStatus(p: { prebuild: Prebuild | undefined; classname?: string }) {
    const prebuild = p.prebuild;

    const { className: iconColorClass, label } = prebuildDisplayProps(prebuild);
    const PrebuildStatusIcon = prebuildStatusIconComponent(prebuild);
    return (
        <div className="flex flex-row gap-1.5 items-center capitalize">
            <PrebuildStatusIcon className={cn(p.classname, iconColorClass)} />
            <span>{label}</span>
        </div>
    );
}

export function PrebuildStatusOld(props: { prebuild: Prebuild | undefined }) {
    const prebuild = props.prebuild;

    return (
        <div className="flex flex-col space-y-1 justify-center text-sm font-semibold">
            <div>
                <div className="flex space-x-1 items-center">
                    {prebuildStatusIcon(prebuild)}
                    {prebuildStatusLabel(prebuild)}
                </div>
            </div>
            <div className="flex space-x-1 items-center text-gray-400">
                <span className="text-left">{getPrebuildStatusDescription(prebuild)}</span>
            </div>
        </div>
    );
}

const prebuildDisplayProps = (prebuild: Prebuild | undefined): { className: string; label: string } => {
    switch (prebuild?.status?.phase?.name) {
        case undefined: // Fall through
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

export const prebuildStatusLabel = (prebuild: Prebuild | undefined): JSX.Element => {
    const { className, label } = prebuildDisplayProps(prebuild);
    return <span className={`font-medium ${className} uppercase`}>{label}</span>;
};

const prebuildStatusIconComponent = (prebuild: Prebuild | undefined): ForwardRefExoticComponent<LucideProps> => {
    switch (prebuild?.status?.phase?.name) {
        case PrebuildPhase_Phase.UNSPECIFIED: // Fall through
        case PrebuildPhase_Phase.QUEUED:
            return PauseCircle;
        case PrebuildPhase_Phase.BUILDING:
            return Clock;
        case PrebuildPhase_Phase.ABORTED:
        case PrebuildPhase_Phase.TIMEOUT:
        case PrebuildPhase_Phase.FAILED:
            return XCircle;
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild?.status?.message) {
                return XCircle;
            }
            return CheckCircle2;
    }

    return XCircle;
};

export const prebuildStatusIcon = (prebuild?: Prebuild) => {
    if (!prebuild) {
        return <Loader2Icon size={20} className="text-gray-500 animate-spin" />;
    }

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

const getPrebuildStatusDescription = (prebuild: Prebuild | undefined): string => {
    switch (prebuild?.status?.phase?.name) {
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

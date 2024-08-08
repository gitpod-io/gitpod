/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import Alert from "../components/Alert";
import { UsageLimitReachedModal } from "../components/UsageLimitReachedModal";
import { Heading2 } from "../components/typography/headings";
import { useDocumentTitle } from "../hooks/use-document-title";
import { gitpodHostUrl } from "../service/service";
import { VerifyModal } from "./VerifyModal";
import { useWorkspaceDefaultImageQuery } from "../data/workspaces/default-workspace-image-query";
import { GetWorkspaceDefaultImageResponse_Source } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { ProductLogo } from "../components/ProductLogo";

export enum StartPhase {
    Checking = 0,
    Preparing = 1,
    Creating = 2,
    Starting = 3,
    Running = 4,
    IdeReady = 5,
    Stopping = 6,
    Stopped = 7,
}

function getPhaseTitle(phase?: StartPhase, error?: StartWorkspaceError) {
    if (!!error) {
        return "Oh, no! Something went wrong!";
    }
    switch (phase) {
        case StartPhase.Checking:
            return "Checking";
        case StartPhase.Preparing:
            return "Preparing";
        case StartPhase.Creating:
            return "Creating";
        case StartPhase.Starting:
            return "Starting";
        case StartPhase.Running:
            return "Starting";
        case StartPhase.IdeReady:
            return "Running";
        case StartPhase.Stopping:
            return "Stopping";
        case StartPhase.Stopped:
            return "Stopped";
        default:
            return "";
    }
}

function ProgressBar(props: { phase: number; error: boolean }) {
    const { phase, error } = props;
    return (
        <div className="flex mt-4 mb-6">
            {[1, 2, 3].map((i) => {
                let classes = "h-2 w-10 mx-1 my-2 rounded-full";
                if (i < phase) {
                    // Already passed this phase successfully
                    classes += " bg-green-400";
                } else if (i > phase) {
                    // Haven't reached this phase yet
                    classes += " bg-gray-200 dark:bg-gray-800";
                } else if (error) {
                    // This phase has failed
                    classes += " bg-red-500";
                } else {
                    // This phase is currently running
                    classes += " bg-green-400 animate-pulse";
                }
                return <div key={"phase-" + i} className={classes} />;
            })}
        </div>
    );
}

export interface StartPageProps {
    phase?: number;
    error?: StartWorkspaceError;
    title?: string;
    children?: React.ReactNode;
    showLatestIdeWarning?: boolean;
    workspaceId?: string;
}

export interface StartWorkspaceError {
    message?: string;
    code?: number;
    data?: any;
}

export function StartPage(props: StartPageProps) {
    const { phase, error, workspaceId } = props;
    let title = props.title || getPhaseTitle(phase, error);
    useDocumentTitle("Starting");
    return (
        <div className="w-screen h-screen align-middle">
            <div className="flex flex-col mx-auto items-center text-center h-screen">
                <div className="h-1/3"></div>
                <ProductLogo
                    className={`h-16 flex-shrink-0 ${
                        error || phase === StartPhase.Stopped || phase === StartPhase.IdeReady ? "" : "animate-bounce"
                    }`}
                />
                <Heading2 className="mt-8">{title}</Heading2>
                {typeof phase === "number" && phase < StartPhase.IdeReady && (
                    <ProgressBar phase={phase} error={!!error} />
                )}
                {error && error.code === ErrorCodes.NEEDS_VERIFICATION && <VerifyModal />}
                {error && error.code === ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED && <UsageLimitReachedModal />}
                {error && <StartError error={error} />}
                {props.children}
                <WarningView
                    workspaceId={workspaceId}
                    showLatestIdeWarning={props.showLatestIdeWarning}
                    error={props.error}
                />
            </div>
        </div>
    );
}

function StartError(props: { error: StartWorkspaceError }) {
    const { error } = props;
    if (!error) {
        return null;
    }
    return <p className="text-base text-gitpod-red w-96">{error.message}</p>;
}

function WarningView(props: { workspaceId?: string; showLatestIdeWarning?: boolean; error?: StartWorkspaceError }) {
    const { data: imageInfo } = useWorkspaceDefaultImageQuery(props.workspaceId);
    let useWarning: "latestIde" | "orgImage" | undefined = props.showLatestIdeWarning ? "latestIde" : undefined;
    if (
        props.error &&
        props.workspaceId &&
        imageInfo &&
        imageInfo.source === GetWorkspaceDefaultImageResponse_Source.ORGANIZATION
    ) {
        useWarning = "orgImage";
    }
    return (
        <div>
            {useWarning === "latestIde" && (
                <Alert type="warning" className="mt-4 w-96">
                    This workspace is configured with the latest release (unstable) for the editor.{" "}
                    <a
                        className="gp-link"
                        target="_blank"
                        rel="noreferrer"
                        href={gitpodHostUrl.asPreferences().toString()}
                    >
                        Change Preferences
                    </a>
                </Alert>
            )}
            {useWarning === "orgImage" && (
                <Alert className="w-96 mt-4" type="warning">
                    <span className="font-medium">Could not use workspace image?</span> Try a different workspace image
                    in the yaml configuration or check the default workspace image in organization settings.
                </Alert>
            )}
        </div>
    );
}

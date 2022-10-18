/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { useEffect } from "react";
import Alert from "../components/Alert";
import gitpodIconUA from "../icons/gitpod.svg";
import { gitpodHostUrl } from "../service/service";
import { VerifyModal } from "./VerifyModal";

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
}

export interface StartWorkspaceError {
    message?: string;
    code?: number;
    data?: any;
}

export function StartPage(props: StartPageProps) {
    const { phase, error } = props;
    let title = props.title || getPhaseTitle(phase, error);
    useEffect(() => {
        document.title = "Starting — Gitpod";
    }, []);
    return (
        <div className="w-screen h-screen align-middle">
            <div className="flex flex-col mx-auto items-center text-center h-screen">
                <div className="h-1/3"></div>
                <img
                    src={gitpodIconUA}
                    alt="Gitpod's logo"
                    className={`h-16 flex-shrink-0 ${
                        error || phase === StartPhase.Stopped || phase === StartPhase.IdeReady ? "" : "animate-bounce"
                    }`}
                />
                <h3 className="mt-8 text-xl">{title}</h3>
                {typeof phase === "number" && phase < StartPhase.IdeReady && (
                    <ProgressBar phase={phase} error={!!error} />
                )}
                {error && error.code === ErrorCodes.NEEDS_VERIFICATION && <VerifyModal />}
                {error && <StartError error={error} />}
                {props.children}
                {props.showLatestIdeWarning && (
                    <Alert type="warning" className="mt-4 w-96">
                        This workspace is configured with the latest release (unstable) for the editor.{" "}
                        <a className="gp-link" target="_blank" href={gitpodHostUrl.asPreferences().toString()}>
                            Change Preferences
                        </a>
                    </Alert>
                )}
                <div className="absolute bottom-4 right-4 text-gray-400 dark:text-gray-500 text-xs font-medium tracking-wide">
                    <span className="mr-1 align-middle">Stand with Ukraine</span>{" "}
                    <svg width="14" height="14" className="inline-block" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 7A7 7 0 1 0 0 7h14Z" fill="#015BBB" />
                        <path d="M0 7a7 7 0 1 0 14 0H0Z" fill="#FC0" />
                    </svg>
                </div>
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

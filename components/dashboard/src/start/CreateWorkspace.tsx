/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { useEffect, useContext, useState } from "react";
import {
    WorkspaceCreationResult,
    RunningWorkspacePrebuildStarting,
    ContextURL,
    DisposableCollection,
    Team,
    GitpodServer,
} from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import Modal from "../components/Modal";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import { StartPage, StartPhase, StartWorkspaceError } from "./StartPage";
import StartWorkspace, { parseProps } from "./StartWorkspace";
import { openAuthorizeWindow } from "../provider-utils";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { SelectAccountModal } from "../settings/SelectAccountModal";
import PrebuildLogs from "../components/PrebuildLogs";
import FeedbackComponent from "../feedback-form/FeedbackComponent";
import { isGitpodIo } from "../utils";
import { BillingAccountSelector } from "../components/BillingAccountSelector";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { TeamsContext } from "../teams/teams-context";
import Alert from "../components/Alert";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";

export interface CreateWorkspaceProps {
    contextUrl: string;
}

export interface CreateWorkspaceState {
    result?: WorkspaceCreationResult;
    error?: StartWorkspaceError;
    selectAccountError?: SelectAccountPayload;
    stillParsing: boolean;
}

export default class CreateWorkspace extends React.Component<CreateWorkspaceProps, CreateWorkspaceState> {
    constructor(props: CreateWorkspaceProps) {
        super(props);
        this.state = { stillParsing: true };
    }

    componentDidMount() {
        this.createWorkspace();
    }

    async createWorkspace(options?: Omit<GitpodServer.CreateWorkspaceOptions, "contextUrl">) {
        // Invalidate any previous result.
        this.setState({ result: undefined, stillParsing: true });

        // We assume anything longer than 3 seconds is no longer just parsing the context URL (i.e. it's now creating a workspace).
        let timeout = setTimeout(() => this.setState({ stillParsing: false }), 3000);

        try {
            const result = await getGitpodService().server.createWorkspace({
                contextUrl: this.props.contextUrl,
                ...options,
            });
            if (result.workspaceURL) {
                window.location.href = result.workspaceURL;
                return;
            }
            clearTimeout(timeout);
            this.setState({ result, stillParsing: false });
        } catch (error) {
            clearTimeout(timeout);
            console.error(error);
            this.setState({ error, stillParsing: false });
        }
    }

    async tryAuthorize(host: string, scopes?: string[]) {
        try {
            await openAuthorizeWindow({
                host,
                scopes,
                onSuccess: () => {
                    window.location.reload();
                },
                onError: (error) => {
                    if (typeof error === "string") {
                        try {
                            const payload = JSON.parse(error);
                            if (SelectAccountPayload.is(payload)) {
                                this.setState({ selectAccountError: payload });
                            }
                        } catch (error) {
                            console.log(error);
                        }
                    }
                },
            });
        } catch (error) {
            console.log(error);
        }
    }

    render() {
        if (SelectAccountPayload.is(this.state.selectAccountError)) {
            return (
                <StartPage phase={StartPhase.Checking}>
                    <div className="mt-2 flex flex-col space-y-8">
                        <SelectAccountModal
                            {...this.state.selectAccountError}
                            close={() => {
                                window.location.href = gitpodHostUrl.asAccessControl().toString();
                            }}
                        />
                    </div>
                </StartPage>
            );
        }

        let phase = StartPhase.Checking;
        let statusMessage = (
            <p className="text-base text-gray-400">
                {this.state.stillParsing ? "Parsing context …" : "Preparing workspace …"}
            </p>
        );

        let error = this.state?.error;
        if (error) {
            switch (error.code) {
                case ErrorCodes.CONTEXT_PARSE_ERROR:
                    statusMessage = (
                        <div className="text-center">
                            <p className="text-base mt-2">
                                Are you trying to open a Git repository from a self-hosted instance?{" "}
                                <a className="text-blue" href={gitpodHostUrl.asAccessControl().toString()}>
                                    Add integration
                                </a>
                            </p>
                        </div>
                    );
                    break;
                case ErrorCodes.INVALID_GITPOD_YML:
                    statusMessage = (
                        <div className="mt-2 flex flex-col space-y-8">
                            <button
                                className=""
                                onClick={() => {
                                    this.createWorkspace({ forceDefaultConfig: true });
                                }}
                            >
                                Continue with default configuration
                            </button>
                        </div>
                    );
                    break;
                case ErrorCodes.NOT_AUTHENTICATED:
                    statusMessage = (
                        <div className="mt-2 flex flex-col space-y-8">
                            <button
                                className=""
                                onClick={() => {
                                    this.tryAuthorize(error?.data.host, error?.data.scopes);
                                }}
                            >
                                Authorize with {error.data.host}
                            </button>
                        </div>
                    );
                    break;
                case ErrorCodes.PERMISSION_DENIED:
                    statusMessage = <p className="text-base text-gitpod-red w-96">Access is not allowed</p>;
                    break;
                case ErrorCodes.USER_BLOCKED:
                    window.location.href = "/blocked";
                    return;
                case ErrorCodes.NOT_FOUND:
                    return <RepositoryNotFoundView error={error} />;
                case ErrorCodes.TOO_MANY_RUNNING_WORKSPACES:
                    // HACK: Hide the error (behind the modal)
                    error = undefined;
                    phase = StartPhase.Stopped;
                    statusMessage = <LimitReachedParallelWorkspacesModal />;
                    break;
                case ErrorCodes.NOT_ENOUGH_CREDIT:
                    // HACK: Hide the error (behind the modal)
                    error = undefined;
                    phase = StartPhase.Stopped;
                    statusMessage = <LimitReachedOutOfHours />;
                    break;
                case ErrorCodes.INVALID_COST_CENTER:
                    // HACK: Hide the error (behind the modal)
                    error = undefined;
                    phase = StartPhase.Stopped;
                    statusMessage = (
                        <SelectCostCenterModal
                            onSelected={() => {
                                this.setState({ error: undefined });
                                this.createWorkspace();
                            }}
                        />
                    );
                    break;
                case ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED:
                    error = undefined; // to hide the error (otherwise rendered behind the modal)
                    phase = StartPhase.Stopped;
                    statusMessage = <UsageLimitReachedModal hints={this.state?.error?.data} />;
                    break;
                default:
                    statusMessage = (
                        <p className="text-base text-gitpod-red w-96">
                            Unknown Error: {JSON.stringify(this.state?.error, null, 2)}
                        </p>
                    );
                    break;
            }
        }

        const result = this.state?.result;
        if (result?.createdWorkspaceId) {
            return <StartWorkspace {...parseProps(result?.createdWorkspaceId, window.location.search)} />;
        } else if (result?.existingWorkspaces) {
            statusMessage = (
                // TODO: Use title and buttons props
                <Modal visible={true} closeable={false} onClose={() => {}}>
                    <h3>Running Workspaces</h3>
                    <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-2">
                        <p className="mt-1 mb-2 text-base">
                            You already have running workspaces with the same context. You can open an existing one or
                            open a new workspace.
                        </p>
                        <>
                            {result?.existingWorkspaces?.map((w) => {
                                const normalizedContextUrl =
                                    ContextURL.getNormalizedURL(w.workspace)?.toString() || "undefined";
                                return (
                                    <a
                                        href={
                                            w.latestInstance?.ideUrl ||
                                            gitpodHostUrl
                                                .with({
                                                    pathname: "/start/",
                                                    hash: "#" + w.latestInstance?.workspaceId,
                                                })
                                                .toString()
                                        }
                                        className="rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-800 flex p-3 my-1"
                                    >
                                        <div className="w-full">
                                            <p className="text-base text-black dark:text-gray-100 font-bold">
                                                {w.workspace.id}
                                            </p>
                                            <p className="truncate" title={normalizedContextUrl}>
                                                {normalizedContextUrl}
                                            </p>
                                        </div>
                                    </a>
                                );
                            })}
                        </>
                    </div>
                    <div className="flex justify-end mt-6">
                        <button onClick={() => this.createWorkspace({ ignoreRunningWorkspaceOnSameCommit: true })}>
                            New Workspace
                        </button>
                    </div>
                </Modal>
            );
        } else if (result?.runningWorkspacePrebuild) {
            return (
                <RunningPrebuildView
                    runningPrebuild={result.runningWorkspacePrebuild}
                    onUseLastSuccessfulPrebuild={() =>
                        this.createWorkspace({ allowUsingPreviousPrebuilds: true, ignoreRunningPrebuild: true })
                    }
                    onIgnorePrebuild={() => this.createWorkspace({ ignoreRunningPrebuild: true })}
                    onPrebuildSucceeded={() => this.createWorkspace()}
                />
            );
        }

        return (
            <StartPage phase={phase} error={error}>
                {statusMessage}
                {error && (
                    <div>
                        <a href={gitpodHostUrl.asDashboard().toString()}>
                            <button className="mt-8 secondary">Go to Dashboard</button>
                        </a>
                        <p className="mt-14 text-base text-gray-400 flex space-x-2">
                            <a
                                className="hover:text-blue-600 dark:hover:text-blue-400"
                                href="https://www.gitpod.io/docs/"
                            >
                                Docs
                            </a>
                            <span>—</span>
                            <a
                                className="hover:text-blue-600 dark:hover:text-blue-400"
                                href="https://status.gitpod.io/"
                            >
                                Status
                            </a>
                            <span>—</span>
                            <a
                                className="hover:text-blue-600 dark:hover:text-blue-400"
                                href="https://www.gitpod.io/blog/"
                            >
                                Blog
                            </a>
                        </p>
                    </div>
                )}
            </StartPage>
        );
    }
}

function SelectCostCenterModal(props: { onSelected?: () => void }) {
    return (
        <Modal visible={true} closeable={false} onClose={() => {}}>
            <h3>Choose Billing Team</h3>
            <BillingAccountSelector onSelected={props.onSelected} />
        </Modal>
    );
}

function LimitReachedModal(p: { children: React.ReactNode }) {
    const { user } = useContext(UserContext);
    return (
        // TODO: Use title and buttons props
        <Modal visible={true} closeable={false} onClose={() => {}}>
            <h3 className="flex">
                <span className="flex-grow">Limit Reached</span>
                <img className="rounded-full w-8 h-8" src={user?.avatarUrl || ""} alt={user?.name || "Anonymous"} />
            </h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-2">
                {p.children}
            </div>
            <div className="flex justify-end mt-6">
                <a href={gitpodHostUrl.asDashboard().toString()}>
                    <button className="secondary">Go to Dashboard</button>
                </a>
                <a href={gitpodHostUrl.with({ pathname: "plans" }).toString()} className="ml-2">
                    <button>Upgrade</button>
                </a>
            </div>
        </Modal>
    );
}

function LimitReachedParallelWorkspacesModal() {
    return (
        <LimitReachedModal>
            <p className="mt-1 mb-2 text-base dark:text-gray-400">
                You have reached the limit of parallel running workspaces for your account. Please, upgrade or stop one
                of the running workspaces.
            </p>
        </LimitReachedModal>
    );
}

function LimitReachedOutOfHours() {
    return (
        <LimitReachedModal>
            <p className="mt-1 mb-2 text-base dark:text-gray-400">
                You have reached the limit of monthly workspace hours for your account. Please upgrade to get more hours
                for your workspaces.
            </p>
        </LimitReachedModal>
    );
}
function UsageLimitReachedModal(p: { hints: any }) {
    const { teams } = useContext(TeamsContext);
    // const [attributionId, setAttributionId] = useState<AttributionId | undefined>();
    const [attributedTeam, setAttributedTeam] = useState<Team | undefined>();

    useEffect(() => {
        const attributionId: AttributionId | undefined = p.hints && p.hints.attributionId;
        if (attributionId) {
            // setAttributionId(attributionId);
            if (attributionId.kind === "team") {
                const team = teams?.find((t) => t.id === attributionId.teamId);
                setAttributedTeam(team);
            }
        }
    }, []);

    const attributedTeamName = attributedTeam?.name;
    return (
        <Modal visible={true} closeable={false} onClose={() => {}}>
            <h3 className="flex">
                <span className="flex-grow">Usage Limit Reached</span>
            </h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-6">
                <Alert type="error" className="app-container rounded-md">
                    You have reached the <strong>usage limit</strong> of your billing account.
                </Alert>
                <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
                    {"Contact a team owner "}
                    {attributedTeamName && (
                        <>
                            of <strong>{attributedTeamName} </strong>
                        </>
                    )}
                    to increase the usage limit, or change your <a href="/billing">billing settings</a>.
                </p>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <a href={gitpodHostUrl.asDashboard().toString()}>
                    <button className="secondary">Go to Dashboard</button>
                </a>
            </div>
        </Modal>
    );
}

function RepositoryNotFoundView(p: { error: StartWorkspaceError }) {
    const [statusMessage, setStatusMessage] = useState<React.ReactNode>();
    const { host, owner, repoName, userIsOwner, userScopes, lastUpdate } = p.error.data;
    const repoFullName = owner && repoName ? `${owner}/${repoName}` : "";

    useEffect(() => {
        (async () => {
            console.log("host", host);
            console.log("owner", owner);
            console.log("repoName", repoName);
            console.log("userIsOwner", userIsOwner);
            console.log("userScopes", userScopes);
            console.log("lastUpdate", lastUpdate);

            const authProvider = (await getGitpodService().server.getAuthProviders()).find((p) => p.host === host);
            if (!authProvider) {
                return;
            }

            // TODO: this should be aware of already granted permissions
            const missingScope = authProvider.authProviderType === "GitHub" ? "repo" : "read_repository";
            const authorizeURL = gitpodHostUrl
                .withApi({
                    pathname: "/authorize",
                    search: `returnTo=${encodeURIComponent(
                        window.location.toString(),
                    )}&host=${host}&scopes=${missingScope}`,
                })
                .toString();

            if (!userScopes.includes(missingScope)) {
                setStatusMessage(
                    <div className="mt-2 flex flex-col space-y-8">
                        <p className="text-base text-gray-400 w-96">
                            The repository may be private. Please authorize Gitpod to access to private repositories.
                        </p>
                        <a className="mx-auto" href={authorizeURL}>
                            <button>Grant Access</button>
                        </a>
                    </div>,
                );
                return;
            }

            if (userIsOwner) {
                setStatusMessage(
                    <div className="mt-2 flex flex-col space-y-8">
                        <p className="text-base text-gray-400 w-96">The repository was not found in your account.</p>
                    </div>,
                );
                return;
            }

            let updatedRecently = false;
            if (lastUpdate && typeof lastUpdate === "string") {
                try {
                    const minutes = (Date.now() - Date.parse(lastUpdate)) / 1000 / 60;
                    updatedRecently = minutes < 5;
                } catch {
                    // ignore
                }
            }

            if (!updatedRecently) {
                setStatusMessage(
                    <div className="mt-2 flex flex-col space-y-8">
                        <p className="text-base text-gray-400 w-96">
                            Permission to access private repositories has been granted. If you are a member of{" "}
                            <code>{owner}</code>, please try to request access for Gitpod.
                        </p>
                        <a className="mx-auto" href={authorizeURL}>
                            <button>Request Access for Gitpod</button>
                        </a>
                    </div>,
                );
                return;
            }

            setStatusMessage(
                <div className="mt-2 flex flex-col space-y-8">
                    <p className="text-base text-gray-400 w-96">
                        Your access token was updated recently. Please try again if the repository exists and Gitpod was
                        approved for <code>{owner}</code>.
                    </p>
                    <a className="mx-auto" href={authorizeURL}>
                        <button>Try Again</button>
                    </a>
                </div>,
            );
        })();
    }, []);

    return (
        <StartPage phase={StartPhase.Checking} error={p.error}>
            <p className="text-base text-gray-400 mt-2">
                <code>{repoFullName}</code>
            </p>
            {statusMessage}
            {p.error && isGitpodIo() && (
                <FeedbackComponent
                    isModal={false}
                    message={"Was this error message helpful?"}
                    isError={true}
                    initialSize={24}
                    errorObject={p.error}
                    errorMessage={p.error.message}
                />
            )}
        </StartPage>
    );
}

interface RunningPrebuildViewProps {
    runningPrebuild: {
        prebuildID: string;
        workspaceID: string;
        instanceID: string;
        starting: RunningWorkspacePrebuildStarting;
        sameCluster: boolean;
    };
    onUseLastSuccessfulPrebuild: () => void;
    onIgnorePrebuild: () => void;
    onPrebuildSucceeded: () => void;
}

function RunningPrebuildView(props: RunningPrebuildViewProps) {
    const workspaceId = props.runningPrebuild.workspaceID;
    const { showUseLastSuccessfulPrebuild } = useContext(FeatureFlagContext);

    useEffect(() => {
        const disposables = new DisposableCollection();

        disposables.push(
            getGitpodService().registerClient({
                onInstanceUpdate: (update) => {
                    if (update.workspaceId !== workspaceId) {
                        return;
                    }
                    if (update.status.phase === "stopped") {
                        props.onPrebuildSucceeded();
                    }
                },
            }),
        );

        return function cleanup() {
            disposables.dispose();
        };
        // eslint-disable-next-line
    }, [workspaceId]);

    return (
        <StartPage title="Prebuild in Progress">
            {/* TODO(gpl) Copied around in Start-/CreateWorkspace. This should properly go somewhere central. */}
            <div className="h-full mt-6 w-11/12 lg:w-3/5">
                <PrebuildLogs workspaceId={workspaceId} onIgnorePrebuild={props.onIgnorePrebuild}>
                    {showUseLastSuccessfulPrebuild && (
                        <button
                            className="secondary"
                            onClick={() => props.onUseLastSuccessfulPrebuild && props.onUseLastSuccessfulPrebuild()}
                        >
                            Use Last Successful Prebuild
                        </button>
                    )}
                    <button className="secondary" onClick={() => props.onIgnorePrebuild && props.onIgnorePrebuild()}>
                        Skip Prebuild
                    </button>
                </PrebuildLogs>
            </div>
        </StartPage>
    );
}

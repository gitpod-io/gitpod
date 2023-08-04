/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    ContextURL,
    DisposableCollection,
    GitpodServer,
    RateLimiterError,
    StartWorkspaceResult,
    WithPrebuild,
    Workspace,
    WorkspaceImageBuild,
    WorkspaceInstance,
} from "@gitpod/gitpod-protocol";
import { IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import EventEmitter from "events";
import * as queryString from "query-string";
import React, { Suspense, useEffect, useState } from "react";
import { v4 } from "uuid";
import Arrow from "../components/Arrow";
import ContextMenu from "../components/ContextMenu";
import PendingChangesDropdown from "../components/PendingChangesDropdown";
import PrebuildLogs from "../components/PrebuildLogs";
import { getGitpodService, gitpodHostUrl, getIDEFrontendService, IDEFrontendService } from "../service/service";
import { StartPage, StartPhase, StartWorkspaceError } from "./StartPage";
import ConnectToSSHModal from "../workspaces/ConnectToSSHModal";
import Alert from "../components/Alert";
import { workspacesService } from "../service/public-api";

const sessionId = v4();

const WorkspaceLogs = React.lazy(() => import("../components/WorkspaceLogs"));

export interface StartWorkspaceProps {
    workspaceId: string;
    runsInIFrame: boolean;
    /**
     * This flag is used to break the autostart-cycle explained in https://github.com/gitpod-io/gitpod/issues/8043
     */
    dontAutostart: boolean;
}

export function parseProps(workspaceId: string, search?: string): StartWorkspaceProps {
    const params = parseParameters(search);
    const runsInIFrame = window.top !== window.self;
    return {
        workspaceId,
        runsInIFrame: window.top !== window.self,
        // Either:
        //  - not_found: we were sent back from a workspace cluster/IDE URL where we expected a workspace to be running but it wasn't because either:
        //    - this is a (very) old tab and the workspace already timed out
        //    - due to a start error our workspace terminated very quickly between:
        //      a) us being redirected to that IDEUrl (based on the first ws-manager update) and
        //      b) our requests being validated by ws-proxy
        //  - runsInIFrame (IDE case):
        //    - we assume the workspace has already been started for us
        //    - we don't know it's instanceId
        dontAutostart: params.notFound || runsInIFrame,
    };
}

function parseParameters(search?: string): { notFound?: boolean } {
    try {
        if (search === undefined) {
            return {};
        }
        const params = queryString.parse(search, { parseBooleans: true });
        const notFound = !!(params && params["not_found"]);
        return {
            notFound,
        };
    } catch (err) {
        console.error("/start: error parsing search params", err);
        return {};
    }
}

export interface StartWorkspaceState {
    /**
     * This is set to the istanceId we started (think we started on).
     * We only receive updates for this particular instance, or none if not set.
     */
    startedInstanceId?: string;
    workspaceInstance?: WorkspaceInstance;
    workspace?: Workspace;
    hasImageBuildLogs?: boolean;
    error?: StartWorkspaceError;
    desktopIde?: {
        link: string;
        label: string;
        clientID?: string;
    };
    ideOptions?: IDEOptions;
    isSSHModalVisible?: boolean;
    ownerToken?: string;
}

export default class StartWorkspace extends React.Component<StartWorkspaceProps, StartWorkspaceState> {
    private ideFrontendService: IDEFrontendService | undefined;

    constructor(props: StartWorkspaceProps) {
        super(props);
        this.state = {};
    }

    private readonly toDispose = new DisposableCollection();
    componentWillMount() {
        if (this.props.runsInIFrame) {
            this.ideFrontendService = getIDEFrontendService(this.props.workspaceId, sessionId, getGitpodService());
            this.toDispose.push(
                this.ideFrontendService.onSetState((data) => {
                    if (data.ideFrontendFailureCause) {
                        const error = { message: data.ideFrontendFailureCause };
                        this.setState({ error });
                    }
                    if (data.desktopIDE?.link) {
                        const label = data.desktopIDE.label || "Open Desktop IDE";
                        const clientID = data.desktopIDE.clientID;
                        const link = data.desktopIDE?.link;
                        this.setState({ desktopIde: { link, label, clientID } });
                    }
                }),
            );
        }

        try {
            this.toDispose.push(
                getGitpodService().registerClient({
                    notifyDidOpenConnection: () => this.fetchWorkspaceInfo(undefined),
                    onInstanceUpdate: (workspaceInstance: WorkspaceInstance) =>
                        this.onInstanceUpdate(workspaceInstance),
                }),
            );
        } catch (error) {
            console.error(error);
            this.setState({ error });
        }

        if (this.props.dontAutostart) {
            // we saw errors previously, or run in-frame
            this.fetchWorkspaceInfo(undefined);
        } else {
            // dashboard case (w/o previous errors): start workspace as quickly as possible
            this.startWorkspace();
        }

        // query IDE options so we can show them if necessary once the workspace is running
        this.fetchIDEOptions();
    }

    componentWillUnmount() {
        this.toDispose.dispose();
    }

    componentDidUpdate(prevPros: StartWorkspaceProps, prevState: StartWorkspaceState) {
        const newPhase = this.state?.workspaceInstance?.status.phase;
        const oldPhase = prevState.workspaceInstance?.status.phase;
        if (newPhase !== oldPhase) {
            getGitpodService().server.trackEvent({
                event: "status_rendered",
                properties: {
                    sessionId,
                    instanceId: this.state.workspaceInstance?.id,
                    workspaceId: this.props.workspaceId,
                    type: this.state.workspace?.type,
                    phase: newPhase,
                },
            });
        }

        if (!!this.state.error && this.state.error !== prevState.error) {
            getGitpodService().server.trackEvent({
                event: "error_rendered",
                properties: {
                    sessionId,
                    instanceId: this.state.workspaceInstance?.id,
                    workspaceId: this.state?.workspace?.id,
                    type: this.state.workspace?.type,
                    error: this.state.error,
                },
            });
        }
    }

    async startWorkspace(restart = false, forceDefaultImage = false) {
        const state = this.state;
        if (state) {
            if (!restart && state.startedInstanceId /* || state.errorMessage */) {
                // We stick with a started instance until we're explicitly told not to
                return;
            }
        }

        const { workspaceId } = this.props;
        try {
            const result = await this.startWorkspaceRateLimited(workspaceId, { forceDefaultImage });
            if (!result) {
                throw new Error("No result!");
            }
            console.log("/start: started workspace instance: " + result.instanceID);

            // redirect to workspaceURL if we are not yet running in an iframe
            if (!this.props.runsInIFrame && result.workspaceURL) {
                // before redirect, make sure we actually have the auth cookie set!
                await this.ensureWorkspaceAuth(result.instanceID, true);
                this.redirectTo(result.workspaceURL);
                return;
            }
            // Start listening too instance updates - and explicitly query state once to guarantee we get at least one update
            // (needed for already started workspaces, and not hanging in 'Starting ...' for too long)
            this.fetchWorkspaceInfo(result.instanceID);
        } catch (error) {
            const normalizedError = typeof error === "string" ? { message: error } : error;
            console.error(normalizedError);

            if (normalizedError?.code === ErrorCodes.USER_BLOCKED) {
                this.redirectTo(gitpodHostUrl.with({ pathname: "/blocked" }).toString());
                return;
            }
            this.setState({ error: normalizedError });
        }
    }

    /**
     * TODO(gpl) Ideally this can be pushed into the GitpodService implementation. But to get started we hand-roll it here.
     * @param workspaceId
     * @param options
     * @returns
     */
    protected async startWorkspaceRateLimited(
        workspaceId: string,
        options: GitpodServer.StartWorkspaceOptions,
    ): Promise<StartWorkspaceResult> {
        let retries = 0;
        while (true) {
            try {
                return await getGitpodService().server.startWorkspace(workspaceId, options);
            } catch (err) {
                if (err?.code !== ErrorCodes.TOO_MANY_REQUESTS) {
                    throw err;
                }

                if (retries >= 10) {
                    throw err;
                }
                retries++;

                const data = err?.data as RateLimiterError | undefined;
                const timeoutSeconds = data?.retryAfter || 5;
                console.log(
                    `startWorkspace was rate-limited: waiting for ${timeoutSeconds}s before doing ${retries}nd retry...`,
                );
                await new Promise((resolve) => setTimeout(resolve, timeoutSeconds * 1000));
            }
        }
    }

    /**
     * Fetches initial WorkspaceInfo from the server. If there is a WorkspaceInstance for workspaceId, we feed it
     * into "onInstanceUpdate" and start accepting further updates.
     *
     * @param startedInstanceId The instanceId we want to listen on
     */
    async fetchWorkspaceInfo(startedInstanceId: string | undefined) {
        // this ensures we're receiving updates for this instance
        if (startedInstanceId) {
            this.setState({ startedInstanceId });
        }

        const { workspaceId } = this.props;
        try {
            const info = await getGitpodService().server.getWorkspace(workspaceId);
            if (info.latestInstance) {
                const instance = info.latestInstance;
                this.setState((s) => ({
                    workspace: info.workspace,
                    startedInstanceId: s.startedInstanceId || instance.id, // note: here's a potential mismatch between startedInstanceId and instance.id. TODO(gpl) How to handle this?
                }));
                this.onInstanceUpdate(instance);
            }
        } catch (error) {
            console.error(error);
            this.setState({ error });
        }
    }

    /**
     * Fetches the current IDEOptions config for this user
     *
     * TODO(gpl) Ideally this would be part of the WorkspaceInstance shape, really. And we'd display options based on
     * what support it was started with.
     */
    protected async fetchIDEOptions() {
        const ideOptions = await getGitpodService().server.getIDEOptions();
        this.setState({ ideOptions });
    }

    async onInstanceUpdate(workspaceInstance: WorkspaceInstance) {
        if (workspaceInstance.workspaceId !== this.props.workspaceId) {
            return;
        }

        // Here we filter out updates to instances we haven't started to avoid issues with updates coming in out-of-order
        // (e.g., multiple "stopped" events from the older instance, where we already started a fresh one after the first)
        // Only exception is when we do the switch from the "old" to the "new" one.
        const startedInstanceId = this.state?.startedInstanceId;
        if (startedInstanceId !== workspaceInstance.id) {
            // do we want to switch to "new" instance we just received an update for?
            const switchToNewInstance =
                this.state.workspaceInstance?.status.phase === "stopped" &&
                workspaceInstance.status.phase !== "stopped";
            if (!switchToNewInstance) {
                return;
            }
            this.setState({
                startedInstanceId: workspaceInstance.id,
                workspaceInstance,
            });

            // now we're listening to a new instance, which might have been started with other IDEoptions
            this.fetchIDEOptions();
        }

        await this.ensureWorkspaceAuth(workspaceInstance.id, false); // Don't block the workspace auth retrieval, as it's guaranteed to get a seconds chance later on!

        // Redirect to workspaceURL if we are not yet running in an iframe.
        // It happens this late if we were waiting for a docker build.
        if (
            !this.props.runsInIFrame &&
            workspaceInstance.ideUrl &&
            (!this.props.dontAutostart || workspaceInstance.status.phase === "running")
        ) {
            (async () => {
                // At this point we cannot be certain that we already have the relevant cookie in multi-cluster
                // scenarios with distributed workspace bridges (control loops): We might receive the update, but the backend might not have the token, yet.
                // So we have to ask again, and wait until we're actually successful (it returns immediately on the happy path)
                await this.ensureWorkspaceAuth(workspaceInstance.id, true);
                this.redirectTo(workspaceInstance.ideUrl);
            })().catch(console.error);
            return;
        }

        if (workspaceInstance.status.phase === "building" || workspaceInstance.status.phase === "preparing") {
            this.setState({ hasImageBuildLogs: true });
        }

        let error: StartWorkspaceError | undefined;
        if (workspaceInstance.status.conditions.failed) {
            error = { message: workspaceInstance.status.conditions.failed };
        }

        // Successfully stopped and headless: the prebuild is done, let's try to use it!
        if (!error && workspaceInstance.status.phase === "stopped" && this.state.workspace?.type !== "regular") {
            // here we want to point to the original context, w/o any modifiers "workspace" was started with (as this might have been a manually triggered prebuild!)
            const contextURL = ContextURL.getNormalizedURL(this.state.workspace);
            if (contextURL) {
                this.redirectTo(gitpodHostUrl.withContext(contextURL.toString()).toString());
            } else {
                console.error(`unable to parse contextURL: ${contextURL}`);
            }
        }

        this.setState({ workspaceInstance, error });
    }

    async ensureWorkspaceAuth(instanceID: string, retry: boolean) {
        if (document.cookie.includes(`${instanceID}_owner_`)) {
            // Cookie already present
            return;
        }

        // TODO(gpl) Would be nice to track # of attempts once we have frontend error monitoring
        const MAX_ATTEMPTS = 10;
        const ATTEMPT_INTERVAL_MS = 2000;
        let attempt = 0;
        let fetchError: Error | undefined = undefined;
        while (attempt <= MAX_ATTEMPTS) {
            attempt++;

            let code: number | undefined = undefined;
            fetchError = undefined;
            try {
                const authURL = gitpodHostUrl.asWorkspaceAuth(instanceID);
                const response = await fetch(authURL.toString());
                code = response.status;
            } catch (err) {
                fetchError = err;
            }

            if (retry) {
                if (code === 404 && !fetchError) {
                    fetchError = new Error("Unable to retrieve workspace-auth cookie (code: 404)");
                }
                if (fetchError) {
                    console.warn("Unable to retrieve workspace-auth cookie! Retrying shortly...", fetchError, {
                        instanceID,
                        code,
                        attempt,
                    });
                    // If the token is not there, we assume it will appear, soon: Retry a couple of times.
                    await new Promise((resolve) => setTimeout(resolve, ATTEMPT_INTERVAL_MS));
                    continue;
                }
            }
            if (code !== 200) {
                // getting workspace auth didn't work as planned
                console.error("Unable to retrieve workspace-auth cookie! Quitting.", {
                    instanceID,
                    code,
                    attempt,
                });
                return;
            }

            // Response code is 200 at this point: done!
            console.info("Retrieved workspace-auth cookie.", { instanceID, code, attempt });
            return;
        }

        console.error("Unable to retrieve workspace-auth cookie! Giving up.", { instanceID, attempt });

        if (fetchError) {
            // To maintain prior behavior we bubble up this error to callers
            throw fetchError;
        }
    }

    redirectTo(url: string) {
        if (this.props.runsInIFrame) {
            this.ideFrontendService?.relocate(url);
        } else {
            window.location.href = url;
        }
    }

    private openDesktopLink(link: string) {
        this.ideFrontendService?.openDesktopIDE(link);
    }

    render() {
        const { error } = this.state;
        const isPrebuild = this.state.workspace?.type === "prebuild";
        const withPrebuild = WithPrebuild.is(this.state.workspace?.context);
        let phase: StartPhase | undefined = StartPhase.Preparing;
        let title = undefined;
        let isTimedOut = false;
        let statusMessage = !!error ? undefined : <p className="text-base text-gray-400">Preparing workspace …</p>;
        const contextURL = ContextURL.getNormalizedURL(this.state.workspace)?.toString();
        const useLatest = !!this.state.workspaceInstance?.configuration?.ideConfig?.useLatest;

        switch (this.state?.workspaceInstance?.status.phase) {
            // unknown indicates an issue within the system in that it cannot determine the actual phase of
            // a workspace. This phase is usually accompanied by an error.
            case "unknown":
                break;
            // Preparing means that we haven't actually started the workspace instance just yet, but rather
            // are still preparing for launch.
            case "preparing":
                phase = StartPhase.Preparing;
                statusMessage = <p className="text-base text-gray-400">Allocating resources …</p>;
                break;
            case "building":
                // Building means we're building the Docker image for the workspace.
                return <ImageBuildView workspaceId={this.state.workspaceInstance.workspaceId} />;

            // Pending means the workspace does not yet consume resources in the cluster, but rather is looking for
            // some space within the cluster. If for example the cluster needs to scale up to accomodate the
            // workspace, the workspace will be in Pending state until that happened.
            case "pending":
                phase = StartPhase.Preparing;
                statusMessage = <p className="text-base text-gray-400">Allocating resources …</p>;
                break;

            // Creating means the workspace is currently being created. That includes downloading the images required
            // to run the workspace over the network. The time spent in this phase varies widely and depends on the current
            // network speed, image size and cache states.
            case "creating":
                phase = StartPhase.Creating;
                statusMessage = <p className="text-base text-gray-400">Pulling container image …</p>;
                break;

            // Initializing is the phase in which the workspace is executing the appropriate workspace initializer (e.g. Git
            // clone or backup download). After this phase one can expect the workspace to either be Running or Failed.
            case "initializing":
                phase = StartPhase.Starting;
                statusMessage = (
                    <p className="text-base text-gray-400">
                        {withPrebuild ? "Loading prebuild …" : "Initializing content …"}
                    </p>
                );
                break;

            // Running means the workspace is able to actively perform work, either by serving a user through Theia,
            // or as a headless workspace.
            case "running":
                if (isPrebuild) {
                    return (
                        <StartPage title="Prebuild in Progress">
                            <div className="mt-6 w-11/12 lg:w-3/5">
                                {/* TODO(gpl) These classes are copied around in Start-/CreateWorkspace. This should properly go somewhere central. */}
                                <PrebuildLogs workspaceId={this.props.workspaceId} />
                            </div>
                        </StartPage>
                    );
                }
                if (!this.state.desktopIde) {
                    phase = StartPhase.Running;
                    statusMessage = <p className="text-base text-gray-400">Opening Workspace …</p>;
                } else {
                    phase = StartPhase.IdeReady;
                    const openLink = this.state.desktopIde.link;
                    const openLinkLabel = this.state.desktopIde.label;
                    const clientID = this.state.desktopIde.clientID;
                    const client = clientID ? this.state.ideOptions?.clients?.[clientID] : undefined;
                    const installationSteps = client?.installationSteps?.length && (
                        <div className="flex flex-col text-center m-auto text-sm w-72 text-gray-400">
                            {client.installationSteps.map((step) => (
                                <div
                                    key={step}
                                    dangerouslySetInnerHTML={{
                                        // eslint-disable-next-line no-template-curly-in-string
                                        __html: step.replaceAll("${OPEN_LINK_LABEL}", openLinkLabel),
                                    }}
                                />
                            ))}
                        </div>
                    );
                    statusMessage = (
                        <div>
                            <p className="text-base text-gray-400">Opening Workspace …</p>
                            <div className="flex space-x-3 items-center text-left rounded-xl m-auto px-4 h-16 w-72 mt-4 mb-2 bg-gray-100 dark:bg-gray-800">
                                <div className="rounded-full w-3 h-3 text-sm bg-green-500">&nbsp;</div>
                                <div>
                                    <p className="text-gray-700 dark:text-gray-200 font-semibold w-56 truncate">
                                        {this.state.workspaceInstance.workspaceId}
                                    </p>
                                    <a target="_parent" href={contextURL}>
                                        <p className="w-56 truncate hover:text-blue-600 dark:hover:text-blue-400">
                                            {contextURL}
                                        </p>
                                    </a>
                                </div>
                            </div>
                            {installationSteps}
                            <div className="mt-10 justify-center flex space-x-2">
                                <ContextMenu
                                    menuEntries={[
                                        {
                                            title: "Open in Browser",
                                            onClick: () => {
                                                this.ideFrontendService?.openBrowserIDE();
                                            },
                                        },
                                        {
                                            title: "Stop Workspace",
                                            onClick: () =>
                                                workspacesService.stopWorkspace({
                                                    workspaceId: this.props.workspaceId,
                                                }),
                                        },
                                        {
                                            title: "Connect via SSH",
                                            onClick: async () => {
                                                const ownerToken = await getGitpodService().server.getOwnerToken(
                                                    this.props.workspaceId,
                                                );
                                                this.setState({ isSSHModalVisible: true, ownerToken });
                                            },
                                        },
                                        {
                                            title: "Go to Dashboard",
                                            href: gitpodHostUrl.asWorkspacePage().toString(),
                                            target: "_parent",
                                        },
                                    ]}
                                >
                                    <button className="secondary">
                                        More Actions...
                                        <Arrow direction={"down"} />
                                    </button>
                                </ContextMenu>
                                <button onClick={() => this.openDesktopLink(openLink)}>{openLinkLabel}</button>
                            </div>
                            {!useLatest && (
                                <Alert type="info" className="mt-4 w-96">
                                    You can change the default editor for opening workspaces in{" "}
                                    <a
                                        className="gp-link"
                                        target="_blank"
                                        rel="noreferrer"
                                        href={gitpodHostUrl.asPreferences().toString()}
                                    >
                                        user preferences
                                    </a>
                                    .
                                </Alert>
                            )}
                            {this.state.isSSHModalVisible === true && this.state.ownerToken && (
                                <ConnectToSSHModal
                                    workspaceId={this.props.workspaceId}
                                    ownerToken={this.state.ownerToken}
                                    ideUrl={this.state.workspaceInstance?.ideUrl.replaceAll("https://", "")}
                                    onClose={() => this.setState({ isSSHModalVisible: false, ownerToken: "" })}
                                />
                            )}
                        </div>
                    );
                }

                break;

            // Interrupted is an exceptional state where the container should be running but is temporarily unavailable.
            // When in this state, we expect it to become running or stopping anytime soon.
            case "interrupted":
                phase = StartPhase.Running;
                statusMessage = <p className="text-base text-gray-400">Checking workspace …</p>;
                break;

            // Stopping means that the workspace is currently shutting down. It could go to stopped every moment.
            case "stopping":
                if (isPrebuild) {
                    return (
                        <StartPage title="Prebuild in Progress">
                            <div className="mt-6 w-11/12 lg:w-3/5">
                                {/* TODO(gpl) These classes are copied around in Start-/CreateWorkspace. This should properly go somewhere central. */}
                                <PrebuildLogs workspaceId={this.props.workspaceId} />
                            </div>
                        </StartPage>
                    );
                }
                phase = StartPhase.Stopping;
                statusMessage = (
                    <div>
                        <div className="flex space-x-3 items-center text-left rounded-xl m-auto px-4 h-16 w-72 mt-4 bg-gray-100 dark:bg-gray-800">
                            <div className="rounded-full w-3 h-3 text-sm bg-gitpod-kumquat">&nbsp;</div>
                            <div>
                                <p className="text-gray-700 dark:text-gray-200 font-semibold w-56 truncate">
                                    {this.state.workspaceInstance.workspaceId}
                                </p>
                                <a target="_parent" href={contextURL}>
                                    <p className="w-56 truncate hover:text-blue-600 dark:hover:text-blue-400">
                                        {contextURL}
                                    </p>
                                </a>
                            </div>
                        </div>
                        <div className="mt-10 flex justify-center">
                            <a target="_parent" href={gitpodHostUrl.asWorkspacePage().toString()}>
                                <button className="secondary">Go to Dashboard</button>
                            </a>
                        </div>
                    </div>
                );
                break;

            // Stopped means the workspace ended regularly because it was shut down.
            case "stopped":
                phase = StartPhase.Stopped;
                if (this.state.hasImageBuildLogs) {
                    const restartWithDefaultImage = (event: React.MouseEvent) => {
                        (event.target as HTMLButtonElement).disabled = true;
                        this.startWorkspace(true, true);
                    };
                    return (
                        <ImageBuildView
                            workspaceId={this.state.workspaceInstance.workspaceId}
                            onStartWithDefaultImage={restartWithDefaultImage}
                            phase={phase}
                            error={error}
                        />
                    );
                }
                if (!isPrebuild && this.state.workspaceInstance.status.conditions.timeout) {
                    title = "Timed Out";
                    isTimedOut = true;
                }
                statusMessage = (
                    <div>
                        <div className="flex space-x-3 items-center text-left rounded-xl m-auto px-4 h-16 w-72 mt-4 mb-2 bg-gray-100 dark:bg-gray-800">
                            <div className="rounded-full w-3 h-3 text-sm bg-gray-300">&nbsp;</div>
                            <div>
                                <p className="text-gray-700 dark:text-gray-200 font-semibold w-56 truncate">
                                    {this.state.workspaceInstance.workspaceId}
                                </p>
                                <a target="_parent" href={contextURL}>
                                    <p className="w-56 truncate hover:text-blue-600 dark:hover:text-blue-400">
                                        {contextURL}
                                    </p>
                                </a>
                            </div>
                        </div>
                        <PendingChangesDropdown workspaceInstance={this.state.workspaceInstance} />
                        <div className="mt-10 justify-center flex space-x-2">
                            <a target="_parent" href={gitpodHostUrl.asWorkspacePage().toString()}>
                                <button className="secondary">Go to Dashboard</button>
                            </a>
                            <a
                                target="_parent"
                                href={gitpodHostUrl.asStart(this.state.workspaceInstance?.workspaceId).toString()}
                            >
                                <button>Open Workspace</button>
                            </a>
                        </div>
                    </div>
                );
                break;
        }
        return (
            <StartPage phase={phase} error={error} title={title} showLatestIdeWarning={!isTimedOut && useLatest}>
                {statusMessage}
            </StartPage>
        );
    }
}

interface ImageBuildViewProps {
    workspaceId: string;
    onStartWithDefaultImage?: (event: React.MouseEvent) => void;
    phase?: StartPhase;
    error?: StartWorkspaceError;
}

function ImageBuildView(props: ImageBuildViewProps) {
    const [logsEmitter] = useState(new EventEmitter());

    useEffect(() => {
        let registered = false;
        const watchBuild = () => {
            if (registered) {
                return;
            }
            registered = true;

            getGitpodService()
                .server.watchWorkspaceImageBuildLogs(props.workspaceId)
                .catch((err) => {
                    registered = false;
                    if (err?.code === ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE) {
                        // wait, and then retry
                        setTimeout(watchBuild, 5000);
                    }
                });
        };
        watchBuild();

        const toDispose = getGitpodService().registerClient({
            notifyDidOpenConnection: () => {
                registered = false; // new connection, we're not registered anymore
                watchBuild();
            },
            onWorkspaceImageBuildLogs: (
                info: WorkspaceImageBuild.StateInfo,
                content?: WorkspaceImageBuild.LogContent,
            ) => {
                if (!content) {
                    return;
                }
                logsEmitter.emit("logs", content.text);
            },
        });

        return function cleanup() {
            toDispose.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <StartPage title="Building Image" phase={props.phase}>
            <Suspense fallback={<div />}>
                <WorkspaceLogs logsEmitter={logsEmitter} errorMessage={props.error?.message} />
            </Suspense>
            {!!props.onStartWithDefaultImage && (
                <>
                    <div className="mt-6 w-11/12 lg:w-3/5">
                        <p className="text-center text-gray-400 dark:text-gray-500">
                            💡 You can use the <code>gp validate</code> command to validate the workspace configuration
                            from the editor terminal. &nbsp;
                            <a
                                href="https://www.gitpod.io/docs/configure/workspaces/workspace-image#trying-out-changes-to-your-dockerfile"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gp-link"
                            >
                                Learn More
                            </a>
                        </p>
                    </div>
                    <button className="mt-6 secondary" onClick={props.onStartWithDefaultImage}>
                        Continue with Default Image
                    </button>
                </>
            )}
        </StartPage>
    );
}

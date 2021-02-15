/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';

// tslint:disable-next-line:max-line-length
import { GitpodService, GitpodClient, WorkspaceInstance, WorkspaceInstanceStatus, WorkspaceImageBuild, WithPrebuild, Branding, Workspace, StartWorkspaceResult, DisposableCollection } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { ShowWorkspaceBuildLogs, WorkspaceBuildLog } from './show-workspace-build-logs';
import { WorkspaceLogView } from './workspace-log-view';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { contextUrlToUrl } from '@gitpod/gitpod-protocol/lib/util/context-url';
import { CubeFrame } from './cube-frame';
import { HeadlessLogEvent } from '@gitpod/gitpod-protocol/lib/headless-workspace-log';
import { ProductivityTips } from './productivity-tips';
import { LicenseCheck } from './license-check';
import { StartupProcess } from './startup-process';
import Button from '@material-ui/core/Button';
import { ResponseError } from 'vscode-jsonrpc';
import { WithBranding } from './with-branding';
import { Context } from '../context';
import { colors } from '../withRoot';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { ApplicationFrame } from './page-frame';
import ShowUnauthorizedError from './show-unauthorized-error';
import { getBlockedUrl } from '../routing';

interface StartWorkspaceState {
    workspace?: Workspace;
    workspaceInstance?: WorkspaceInstance;
    errorMessage?: string;
    errorCode?: number;
    errorData?: any;
    buildLog?: WorkspaceBuildLog;
    headlessLog?: string;
    progress: number;
    startedInstanceId?: string;
    inTheiaAlready?: boolean;
    ideFrontendFailureCause?: string;
    remainingUsageHours?: number;
}

export interface StartWorkspaceProps {
    /**
     * On initial mount, this might be undefined because the workspace has not been created yet.
     * The component might receive it later once the creation succeeded.
     */
    workspaceId?: string;
    service: GitpodService;

    startErrorRenderer?: StartErrorRenderer;
}
export type StartErrorRenderer = (errorCode: number, service: GitpodService, onResolved: () => void) => JSX.Element | undefined;

export class StartWorkspace extends React.Component<StartWorkspaceProps, StartWorkspaceState> implements Partial<GitpodClient> {
    private process: StartupProcess;
    private isHeadless: boolean = false;
    private isPrebuilt: boolean | undefined;
    private workspaceInfoReceived: boolean = false;
    private userHasAlreadyCreatedWorkspaces?: boolean;
    private workspace: Workspace | undefined;
    private branding: Branding | undefined;

    constructor(props: StartWorkspaceProps) {
        super(props);
        this.process = new StartupProcess((progress) => this.updateProgress(progress));
        this.state = {
            progress: 0
        };
    }

    private updateProgress(progress: number) {
        this.setState({ progress });
    }

    private getProgress() {
        if (this.state) {
            return this.state.progress * 100;
        } else {
            return 0;
        }
    }

    private readonly toDispose = new DisposableCollection();
    componentWillMount() {
        if (window.self !== window.top) {
            const setStateEventListener = (event: MessageEvent) => {
                if (event.data.type === 'setState' && 'state' in event.data && typeof event.data['state'] === 'object') {
                    this.setState(event.data.state);
                }
            }
            window.addEventListener('message', setStateEventListener, false);
            this.toDispose.push({
                dispose: () => window.removeEventListener('message', setStateEventListener)
            });
            this.setState({ inTheiaAlready: true });
        }

        this.queryInitialState();
        this.startWorkspace(this.props.workspaceId);
    }

    notifyDidOpenConnection(): void {
        this.ensureWorkspaceInfo({ force: true });
    }

    protected async queryInitialState() {
        WithBranding.getBranding(this.props.service, true)
            .then(branding => this.branding = branding)
            .catch(e => console.log("cannot update branding", e));

        const createWorkspacesBeforePromise = this.didUserCreateWorkspaceBefore();
        const workspaceInfoPromise = this.ensureWorkspaceInfo({ force: false });

        try {
            this.toDispose.push(this.props.service.registerClient(this));
        } catch (err) {
            log.error(err);
            this.setErrorState(err);
        }

        await workspaceInfoPromise;
        this.userHasAlreadyCreatedWorkspaces = await createWorkspacesBeforePromise;
    }

    componentWillReceiveProps(nextProps: StartWorkspaceProps) {
        this.startWorkspace(nextProps.workspaceId);
    }

    protected startWorkspace(workspaceId: string | undefined, restart: boolean = false, forceDefaultImage: boolean = false) {
        if (!workspaceId) {
            return;
        }
        const state = this.state;
        if (state) {
            if (!restart && (state.startedInstanceId || state.errorMessage)) {
                // We stick with a started instance until we're explicitly told not to
                return;
            }
        }

        const defaultErrMessage = `Error while starting workspace ${workspaceId}`;
        this.props.service.server.startWorkspace(workspaceId, { forceDefaultImage })
            .then((workspaceStartedResult: StartWorkspaceResult) => {
                if (!workspaceStartedResult) {
                    this.setErrorState(defaultErrMessage);
                } else {
                    console.log("/start: started workspace instance: " + workspaceStartedResult.instanceID);
                    // redirect to workspaceURL if we are not yet running in an iframe
                    if (!this.runsInIFrame() && workspaceStartedResult.workspaceURL) {
                        this.redirectTo(workspaceStartedResult.workspaceURL);
                    }
                    this.setState({ startedInstanceId: workspaceStartedResult.instanceID, errorMessage: undefined, errorCode: undefined, errorData: undefined });
                    // Explicitly query state to guarantee we get at least one update
                    // (needed for already started workspaces, and not hanging in 'Starting ...' for too long)
                    this.props.service.server.getWorkspace(workspaceId).then(ws => {
                        if (ws.latestInstance) {
                            this.setState({
                                workspace: ws.workspace
                            });
                            this.onInstanceUpdate(ws.latestInstance);
                        }
                    });
                }
            })
            .catch(err => {
                this.setErrorState(err, defaultErrMessage);
                console.error(err);
            });
    }

    protected setErrorState(err: any, defaultErrorMessage?: string) {
        let errorMessage = defaultErrorMessage;
        let errorCode = undefined;
        let errorData = undefined;
        if (err instanceof ResponseError) {
            errorCode = err.code;
            errorData = err.data;
            errorMessage = err.message;

            switch (err.code) {
                case ErrorCodes.USER_BLOCKED:
                    this.redirectTo(getBlockedUrl());
                    return;
                case ErrorCodes.SETUP_REQUIRED:
                    this.redirectTo(new GitpodHostUrl(window.location.toString()).with({ pathname: "first-steps" }).toString());
                    return;
                case ErrorCodes.USER_TERMS_ACCEPTANCE_REQUIRED:
                    const thisUrl = window.location.toString();
                    this.redirectTo(new GitpodHostUrl(thisUrl).withApi({ pathname: "/tos", search: `mode=update&returnTo=${encodeURIComponent(thisUrl)}` }).toString());
                    return;
                case ErrorCodes.NOT_AUTHENTICATED:
                    if (err.data) {
                        this.setState({ errorMessage, errorCode, errorData });
                    } else {
                        const url = new GitpodHostUrl(window.location.toString()).withApi({
                            pathname: '/login/',
                            search: 'returnTo=' + encodeURIComponent(window.location.toString())
                        }).toString();
                        this.redirectTo(url);
                    }
                    return;
                case ErrorCodes.USER_DELETED:
                    window.location.href = new GitpodHostUrl(window.location.toString()).asApiLogout().toString();
                    return;
                default:
            }
        }
        if (err && err.message) {
            errorMessage = err.message;
        } else if (err && typeof err === 'string') {
            errorMessage = err;
        }
        this.setState({ errorMessage, errorCode, errorData });
    }

    componentWillUnmount() {
        this.toDispose.dispose();
    }

    onCreditAlert({ remainingUsageHours }: { remainingUsageHours: number }) {
        this.setState({ remainingUsageHours });
    }

    async onInstanceUpdate(workspaceInstance: WorkspaceInstance) {
        const startedInstanceId = this.state && this.state.startedInstanceId;
        if (workspaceInstance.workspaceId !== this.props.workspaceId
            || startedInstanceId !== workspaceInstance.id) {
            return;
        }

        await this.ensureWorkspaceInfo({ force: false });
        await this.ensureWorkspaceAuth(workspaceInstance.id);

        // redirect to workspaceURL if we are not yet running in an iframe
        // it happens this late if we were waiting for a docker build.
        if (!this.runsInIFrame() && workspaceInstance.ideUrl) {
            this.redirectTo(workspaceInstance.ideUrl);
        }

        if (workspaceInstance.status.phase === 'preparing') {
            this.props.service.server.watchWorkspaceImageBuildLogs(workspaceInstance.workspaceId);
        }
        if (workspaceInstance.status.phase === 'pending') {
            if (this.isPrebuilt) {
                this.process.stages['restoring-prebuild'].expectedTime = 30 * 1000;
            } else {
                // remove RestoringPrebuild phase to prevent stray stage when not starting from a prebuild
                delete this.process.stages['restoring-prebuild'];
            }
            this.process.startProcess();
        }
        if (workspaceInstance.status.phase === 'initializing') {
            this.process.startProcess();

            if (this.isPrebuilt) {
                // for good measure: try and start the process just in case we missed the previous events. startProcess is idempotent.
                this.process.startProcess();

                setTimeout(() => {
                    this.process.setStage('restoring-prebuild');
                    // tslint:disable-next-line:no-shadowed-variable
                    const workspaceInstance = this.state.workspaceInstance;
                    if (workspaceInstance) {
                        (workspaceInstance.status.phase as (WorkspaceInstanceStatus | 'restoring-prebuild')) = 'restoring-prebuild';
                        this.setState({ workspaceInstance });
                    }
                    // tslint:disable-next-line:align
                }, this.process.stages['initializing'].expectedTime);

                if (workspaceInstance && workspaceInstance.status.phase === 'initializing'
                    && this.state.workspaceInstance && this.state.workspaceInstance.status.phase as any === 'restoring-prebuild') {
                    // we're already in the "fake" restoring-prebuild phase - don't fall back to StartingIDE
                    return;
                }
            }
        }
        if (workspaceInstance.status.phase === 'running') {
            if (this.isHeadless) {
                this.props.service.server.watchHeadlessWorkspaceLogs(workspaceInstance.workspaceId);
            }
        }
        if (workspaceInstance.status.phase === 'stopped') {
            if (this.isHeadless && this.workspace) {
                const contextUrl = this.workspace.contextURL.replace('prebuild/', '')!;
                this.redirectTo(new GitpodHostUrl(window.location.toString()).withContext(contextUrl).toString());
            }
        }

        this.process.setStage(workspaceInstance.status.phase);

        this.setState({
            workspaceInstance,
            errorMessage: workspaceInstance.status.conditions.failed,
            errorCode: undefined
        });
    }

    protected async ensureWorkspaceInfo({ force }: { force: boolean }) {
        if (this.props.workspaceId && (force || !this.workspaceInfoReceived)) {
            try {
                const info = await this.props.service.server.getWorkspace(this.props.workspaceId);
                this.workspace = info.workspace;
                this.isHeadless = info.workspace.type !== 'regular';
                this.isPrebuilt = WithPrebuild.is(info.workspace.context);
                this.workspaceInfoReceived = true;

                if (info.latestInstance) {
                    // Potentially indirect recursive call, guarded by workspaceInfoReceived
                    this.onInstanceUpdate(info.latestInstance);
                }
            } catch (err) {
                log.error(err);
                this.setErrorState(err);
            }
        }
    }

    protected async ensureWorkspaceAuth(instanceID: string) {
        if (!document.cookie.includes(`${instanceID}_owner_`)) {
            const authURL = new GitpodHostUrl(window.location.toString()).asWorkspaceAuth(instanceID);
            const response = await fetch(authURL.toString());
            if (response.redirected) {
                this.redirectTo(response.url);
                return;
            }
            if (!response.ok) {
                // getting workspace auth didn't work as planned - redirect
                this.redirectTo(authURL.asWorkspaceAuth(instanceID, true).toString());
            }
        }
    }

    async didUserCreateWorkspaceBefore() {
        const workspaces = await this.props.service.server.getWorkspaces({});
        return workspaces.length > 0;
    }

    onWorkspaceImageBuildLogs(info: WorkspaceImageBuild.StateInfo, content: WorkspaceImageBuild.LogContent): void {
        this.setState({
            buildLog: {
                info,
                content
            }
        });
    }

    onHeadlessWorkspaceLogs(evt: HeadlessLogEvent): void {
        this.setState({ headlessLog: evt.text });
    }

    protected redirectToDashboard() {
        const url = new GitpodHostUrl(window.location.toString()).asDashboard().toString();
        this.redirectTo(url);
    }

    protected redirectTo(url: string) {
        // am I running in Iframe?
        if (this.runsInIFrame()) {
            window.parent.postMessage({ type: 'relocate', url }, '*');
        } else {
            window.location.href = url;
        }
    }

    protected runsInIFrame() {
        return window.top !== window.self;
    }

    protected renderError() {
        const { errorCode, errorData } = this.state;
        const startErrorRenderer = this.props.startErrorRenderer;
        if (startErrorRenderer && errorCode) {
            const rendered = startErrorRenderer(errorCode, this.props.service, () => this.startWorkspace(this.props.workspaceId, true, false));
            if (rendered) {
                return rendered;
            }
        }
        if (errorCode === ErrorCodes.SETUP_REQUIRED) {
            return <ApplicationFrame />;
        }
        if (errorCode === ErrorCodes.USER_TERMS_ACCEPTANCE_REQUIRED) {
            return <ApplicationFrame />;
        }
        if (errorCode === ErrorCodes.NOT_AUTHENTICATED) {
            if (errorData?.host && errorData?.scopes && errorData?.messageHint) {
                return (
                    <ApplicationFrame service={this.props.service}>
                        <ShowUnauthorizedError data={errorData} />
                    </ApplicationFrame>
                );
            }
        }
        return undefined;
    }

    render() {
        const { errorCode, errorMessage } = this.state;

        if (errorCode) {
            const handled = this.renderError();
            if (handled) {
                return handled;
            }
        }

        let message = <div className='message'>Starting...</div>;
        if (this.state && this.state.workspaceInstance) {
            message = <div className='message'>
                {this.process.getLabel(this.state.workspaceInstance.status.phase)}
            </div>;
            const phase = this.state.workspaceInstance.status.phase;
            if (!this.isHeadless && (phase === 'stopped' ||
                phase === 'stopping')) {
                let stoppedReason = `The workspace ${phase === 'stopped' ? 'has stopped' : 'is stopping'}.`;
                if (this.state.workspaceInstance.status.conditions.timeout) {
                    stoppedReason = `The workspace timed out and ${phase === 'stopped' ? 'has stopped' : 'is stopping'}.`;
                } else if (this.state.workspaceInstance.status.conditions.failed) {
                    stoppedReason = this.state.workspaceInstance.status.conditions.failed;
                } else if (this.state.workspaceInstance.status.message) {
                    stoppedReason = this.state.workspaceInstance.status.message;
                }
                // capitalize message
                stoppedReason = stoppedReason.charAt(0).toUpperCase() + stoppedReason.slice(1);

                if (!stoppedReason.endsWith(".")) {
                    stoppedReason += ".";
                }

                const pendingChanges: { message: string, items: string[] }[] = [];
                const repo = this.state.workspaceInstance && this.state.workspaceInstance.status && this.state.workspaceInstance.status.repo;
                if (repo) {
                    if (repo.totalUncommitedFiles || 0 > 0) {
                        pendingChanges.push({
                            message: repo.totalUncommitedFiles === 1 ? 'an uncommited file' : `${repo.totalUncommitedFiles} uncommited files`,
                            items: repo.uncommitedFiles || []
                        });
                    }
                    if (repo.totalUntrackedFiles || 0 > 0) {
                        pendingChanges.push({
                            message: repo.totalUntrackedFiles === 1 ? 'an untracked file' : `${repo.totalUntrackedFiles} untracked files`,
                            items: repo.untrackedFiles || []
                        });
                    }
                    if (repo.totalUnpushedCommits || 0 > 0) {
                        pendingChanges.push({
                            message: repo.totalUnpushedCommits === 1 ? 'an unpushed commit' : `${repo.totalUnpushedCommits} unpushed commits`,
                            items: repo.unpushedCommits || []
                        });
                    }
                }

                const urls = new GitpodHostUrl(window.location.toString());
                const startUrl = urls.asStart(this.props.workspaceId).toString();
                const ctxUrl = this.state.workspace?.contextURL ? contextUrlToUrl(this.state.workspace!.contextURL)! : new URL(urls.asDashboard().toString());
                const host = "Back to " + ctxUrl.host;
                message = <React.Fragment>
                    <div className='message'>
                        <div style={{ display: '' }}>
                            <div style={{ fontWeight: 800 }}>{stoppedReason}</div>
                            {phase === 'stopped' ? (pendingChanges.length === 0 ? <div style={{ color: colors.fontColor3 }}>There are no pending changes. All good.</div> : (
                                <div style={{ margin: "20px auto", width: '30%', textAlign: 'left', overflow: 'scroll', maxHeight: 150 }}>
                                    <div style={{ color: colors.brand2, fontWeight: 800 }}>The workspace has pending changes.  You can restart it to continue your work.</div>
                                    {pendingChanges.map(c => {
                                        return <React.Fragment>
                                            <div style={{ marginLeft: 0, color: colors.fontColor3 }}>
                                                {c.message}
                                            </div>
                                            {c.items.map(i => {
                                                return <div><code style={{ marginLeft: 20, whiteSpace: 'nowrap' }}>
                                                    - {i}
                                                </code></div>
                                            })}
                                        </React.Fragment>
                                    })}
                                </div>
                            )) : undefined}
                            <div className='start-action'>
                                <Button className='button' variant='outlined' color='primary'
                                    onClick={() => this.redirectTo(this.state.workspace!.contextURL)}>{host}</Button>
                                <Button className='button' variant='outlined' color={pendingChanges.length !== 0 ? 'secondary' : 'primary'}
                                    disabled={phase !== 'stopped'}
                                    onClick={() => this.redirectTo(startUrl)}>Start Workspace</Button></div>
                        </div>
                    </div>
                </React.Fragment >;
            }
        }

        let logs: JSX.Element | undefined;
        const instance = this.state && this.state.workspaceInstance;
        // stopped status happens when the build failed. We still want to see the log output in that case
        const isBuildingWorkspaceImage = instance && (instance.status.phase === 'preparing' || instance.status.phase === 'stopped' && this.state.buildLog);
        const isHeadlessBuildRunning = this.isHeadless && instance && (instance.status.phase === 'running' || instance.status.phase === 'stopping');
        const isError = !!errorMessage;
        let cubeErrorMessage = errorMessage;

        if (isBuildingWorkspaceImage) {
            logs = <ShowWorkspaceBuildLogs buildLog={this.state.buildLog} errorMessage={errorMessage} showPhase={!isError} />;
            cubeErrorMessage = ""; // errors will be shown in the output already
        } else if (isHeadlessBuildRunning) {
            logs = <WorkspaceLogView content={this.state.headlessLog} />;
            cubeErrorMessage = "";
        }

        if (isError) {
            // If docker build failed
            if (isBuildingWorkspaceImage) {
                message = <div className="message action">
                    <Button className='button' variant='outlined' color='secondary' onClick={() => {
                        this.startWorkspace(this.props.workspaceId, true, true);
                    }}>Start with Default Docker Image</Button>
                </div>;
            } else if (!isHeadlessBuildRunning) {
                message = <div className="message action">
                    <Button className='button' variant='outlined' color='secondary' onClick={() => this.redirectToDashboard()}>Go to Workspaces</Button>
                </div>;
            }
        }
        if (this.state && this.state.workspaceInstance && this.state.workspaceInstance.status.phase === 'running') {
            if (this.state.remainingUsageHours !== undefined && this.state.remainingUsageHours <= 0) {
                cubeErrorMessage = 'You have run out of Gitpod Hours.';
                message = <div className='message action'>
                    <Button className='button' variant='outlined' color='secondary' onClick={() =>
                        window.open(new GitpodHostUrl(window.location.toString()).asUpgradeSubscription().toString(), '_blank')
                    }>Upgrade Subscription</Button>
                </div>;
            } else if (this.state.inTheiaAlready) {
                if (this.state.ideFrontendFailureCause) {
                    cubeErrorMessage = this.state.ideFrontendFailureCause;
                    message = <div className='message'>Something went wrong, try to reload the page.</div>;
                } else {
                    message = <div className='message'></div>;
                }
            } else {
                this.ensureWorkspaceAuth(this.state.workspaceInstance.id)
                    .then(() => { window.location.href = this.state.workspaceInstance!.ideUrl; });
            }
        }

        const showProductivityTips = this.branding ? this.branding.showProductivityTips : false;
        const shouldRenderTips = showProductivityTips && !logs && !isError && this.userHasAlreadyCreatedWorkspaces !== undefined && this.runsInIFrame() &&
            !(this.state.workspaceInstance && (this.state.workspaceInstance.status.phase === 'stopping' || this.state.workspaceInstance.status.phase === 'stopped'));
        const productivityTip = shouldRenderTips ? <ProductivityTips userHasCreatedWorkspaces={this.userHasAlreadyCreatedWorkspaces} /> : undefined;
        const isStopped = this.state.workspaceInstance && this.state.workspaceInstance.status.phase === 'stopped';
        return (
            <WithBranding service={this.props.service}>
                <Context.Consumer>
                    {(ctx) =>
                        <CubeFrame
                            errorMessage={cubeErrorMessage}
                            errorMode={isError}
                            branding={ctx.branding}
                            stoppedAnimation={isStopped}>
                            <LicenseCheck service={this.props.service.server} />
                            <div className="progress"><div className="runner" style={{ width: this.getProgress() + "%" }}></div></div>
                            {message}
                            {logs}
                            {productivityTip}
                        </CubeFrame>
                    }
                </Context.Consumer>
            </WithBranding>
        );
    }

}
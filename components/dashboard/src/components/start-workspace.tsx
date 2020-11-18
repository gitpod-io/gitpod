/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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
import { CubeFrame } from './cube-frame';
import { HeadlessLogEvent } from '@gitpod/gitpod-protocol/lib/headless-workspace-log';
import { ProductivityTips } from './productivity-tips';
import { LicenseCheck } from './license-check';
import { StartupProcess } from './startup-process';
import Button from '@material-ui/core/Button';
import { ResponseError } from 'vscode-jsonrpc';
import { WithBranding } from './with-branding';
import { Context } from '../context';

interface StartWorkspaceState {
    workspaceInstance?: WorkspaceInstance;
    errorMessage?: string;
    errorCode?: number;
    buildLog?: WorkspaceBuildLog;
    headlessLog?: string;
    progress: number;
    startedInstanceId?: string;
    inTheiaAlready?: boolean;
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
        this.queryInitialState();
        this.startWorkspace(this.props.workspaceId);
    }

    notifyDidOpenConnection(): void {
        this.ensureWorkspaceInfo({ force: true });
    }

    protected async queryInitialState() {
        if (window.self !== window.top) {
            this.setState({ inTheiaAlready: true });
        }
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
                    this.setState({ startedInstanceId: workspaceStartedResult.instanceID, errorMessage: undefined, errorCode: undefined });
                    // Explicitly query state to guarantee we get at least one update
                    // (needed for already started workspaces, and not hanging in 'Starting ...' for too long)
                    this.props.service.server.getWorkspace(workspaceId).then(ws => {
                        if (ws.latestInstance) {
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
        if (err instanceof ResponseError) {
            errorCode = err.code;
        }
        if (err && err.message) {
            errorMessage = err.message;
        } else if (err && typeof err === 'string') {
            errorMessage = err;
        }
        this.setState({ errorMessage, errorCode });
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
        if (workspaceInstance.status.phase === 'stopping') {
            if (this.isHeadless) {
                if (this.workspace) {
                    const ctxUrl = this.workspace.contextURL.replace('prebuild/', '');
                    this.redirectTo(new GitpodHostUrl(window.location.toString()).withContext(ctxUrl).toString());
                } else {
                    this.redirectToDashboard();
                }
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
                this.isHeadless = info.workspace.type != 'regular';
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

    render() {
        const errorCode = this.state && this.state.errorCode;

        const startErrorRenderer = this.props.startErrorRenderer;
        if (startErrorRenderer && errorCode) {
            const rendered = startErrorRenderer(errorCode, this.props.service, () => this.startWorkspace(this.props.workspaceId, true, false));
            if (rendered) {
                return rendered;
            }
        }

        let message = <div className='message'>Starting...</div>;
        if (this.state && this.state.workspaceInstance) {
            message = <div className='message'>
                {this.process.getLabel(this.state.workspaceInstance.status.phase)}
            </div>;
            if (this.state.workspaceInstance.status.phase === 'stopping'
                || this.state.workspaceInstance.status.phase === 'stopped') {
                let stoppedReason;
                if (this.state.workspaceInstance.status.conditions.timeout) {
                    stoppedReason = "Workspace has timed out.";
                } else if (this.state.workspaceInstance.status.conditions.failed) {
                    stoppedReason = this.state.workspaceInstance.status.conditions.failed;
                } else if (this.state.workspaceInstance.status.message) {
                    stoppedReason = this.state.workspaceInstance.status.message;
                }
                if (stoppedReason) {
                    // capitalize message
                    stoppedReason = stoppedReason.charAt(0).toUpperCase() + stoppedReason.slice(1);

                    if (!stoppedReason.endsWith(".")) {
                        stoppedReason += ".";
                    }
                    message = <React.Fragment>
                        {message}
                        <div className='message stopped-reason'>{stoppedReason}</div>
                    </React.Fragment>;
                }
            }
            if (this.state.workspaceInstance.status.phase === 'stopped' && this.props.workspaceId) {
                const startUrl = new GitpodHostUrl(window.location.toString()).asStart(this.props.workspaceId).toString();
                message = <React.Fragment>
                    {message}
                    <div className='message start-action'><Button className='button' variant='outlined' color='secondary' onClick={() => {
                        this.redirectTo(startUrl)
                    }}>Start Workspace</Button></div>
                </React.Fragment>;
            }
        }

        let logs: JSX.Element | undefined;
        const instance = this.state && this.state.workspaceInstance;
        // stopped status happens when the build failed. We still want to see the log output in that case
        const isBuildingWorkspaceImage = instance && (instance.status.phase === 'preparing' || instance.status.phase === 'stopped' && this.state.buildLog);
        const isHeadlessBuildRunning = this.isHeadless && instance && instance.status.phase === 'running' && this.state.headlessLog;
        const isError = this.state && !!this.state.errorMessage;
        let errorMessage = this.state && this.state.errorMessage;
        if (isBuildingWorkspaceImage) {
            logs = <ShowWorkspaceBuildLogs buildLog={this.state.buildLog} errorMessage={errorMessage} showPhase={!isError} />;
            errorMessage = ""; // errors will be shown in the output already
        } else if (isHeadlessBuildRunning) {
            logs = <WorkspaceLogView content={this.state.headlessLog} />;
        }

        if (isError) {
            // If docker build failed
            if (isBuildingWorkspaceImage) {
                message = <div className="message action">
                    <Button className='button' variant='outlined' color='secondary' onClick={() => {
                        this.startWorkspace(this.props.workspaceId, true, true);
                    }}>Start with Default Docker Image</Button>
                </div>;
            } else {
                message = <div className="message action">
                    <Button className='button' variant='outlined' color='secondary' onClick={() => this.redirectToDashboard()}>Go to Workspaces</Button>
                </div>;
            }
        }
        if (this.state && this.state.workspaceInstance && this.state.workspaceInstance.status.phase == 'running') {
            if (this.state.remainingUsageHours !== undefined && this.state.remainingUsageHours <= 0) {
                errorMessage = 'You have run out of Gitpod Hours.';
                message = <div className='message action'>
                    <Button className='button' variant='outlined' color='secondary' onClick={() =>
                        window.open(new GitpodHostUrl(window.location.toString()).asUpgradeSubscription().toString(), '_blank')
                    }>Upgrade Subscription</Button>
                </div>;
            } else if (this.state.inTheiaAlready) {
                message = <div className='message'></div>;
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
                            errorMessage={errorMessage}
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
/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';

// tslint:disable-next-line:max-line-length
import { GitpodService, GitpodClient, WorkspaceInstance, WorkspaceInstanceStatus, WorkspaceImageBuild, WithPrebuild, Branding, Workspace, StartWorkspaceResult, DisposableCollection, WorkspaceInstanceUpdateListener } from '@gitpod/gitpod-protocol';
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
import { colors } from '../withRoot';

interface StartWorkspaceState {
    wsListener?: WorkspaceInstanceUpdateListener;
    workspaceInstance?: WorkspaceInstance;
    errorMessage?: string;
    errorCode?: number;
    buildLog?: WorkspaceBuildLog;
    headlessLog?: string;
    progress: number;
    remainingUsageHours?: number;
    userHasAlreadyCreatedWorkspaces?: boolean;
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

    private getWorkspace(): Workspace | undefined {
        return this.state && this.state.wsListener && this.state.wsListener.info && this.state.wsListener.info.workspace;
    }
    private isHeadless(): boolean {
        return !!(this.getWorkspace()?.type !== 'regular');
    }
    private isPrebuilt(): boolean {
        return WithPrebuild.is(this.getWorkspace()?.context);
    }
    private workspaceInfoReceived: boolean = false;
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
        this.startWorkspace(this.props.workspaceId).then(() => {
            this.queryInitialState();
        });
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
        createWorkspacesBeforePromise.then(userHasAlreadyCreatedWorkspaces => {
            this.setState({userHasAlreadyCreatedWorkspaces});
        });
    }

    componentWillReceiveProps(nextProps: StartWorkspaceProps) {
        this.startWorkspace(nextProps.workspaceId);
    }

    private startedInstanceId(): string | undefined {
        return this.state && this.state.workspaceInstance && this.state.workspaceInstance.id;
    }

    protected async startWorkspace(workspaceId: string | undefined, restart: boolean = false, forceDefaultImage: boolean = false) {
        if (!workspaceId) {
            return;
        }
        const state = this.state;
        if (state) {
            if (!restart && (this.startedInstanceId() || state.errorMessage)) {
                // We stick with a started instance until we're explicitly told not to
                return;
            }
        }

        const defaultErrMessage = `Error while starting workspace ${workspaceId}`;
        const workspaceStartedResult: StartWorkspaceResult = await this.props.service.server.startWorkspace(workspaceId, { forceDefaultImage });
        if (!workspaceStartedResult) {
            this.setErrorState(defaultErrMessage);
            return;
        } else {
            // redirect to workspaceURL if we are not yet running in an iframe
            if (!this.runsInIFrame() && workspaceStartedResult.workspaceURL) {
                this.redirectTo(workspaceStartedResult.workspaceURL);
            }
            this.setState({
                errorMessage: undefined, 
                errorCode: undefined 
            });
        }
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
        if (workspaceInstance.workspaceId !== this.props.workspaceId
            || (this.startedInstanceId() !== undefined
            && this.startedInstanceId() !== workspaceInstance.id)) {
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
            if (this.isPrebuilt()) {
                this.process.stages['restoring-prebuild'].expectedTime = 30 * 1000;
            } else {
                // remove RestoringPrebuild phase to prevent stray stage when not starting from a prebuild
                delete this.process.stages['restoring-prebuild'];
            }
            this.process.startProcess();
        }
        if (workspaceInstance.status.phase === 'initializing') {
            this.process.startProcess();

            if (this.isPrebuilt()) {
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
            if (this.isHeadless()) {
                this.props.service.server.watchHeadlessWorkspaceLogs(workspaceInstance.workspaceId);
            }
        }
        if (workspaceInstance.status.phase === 'stopped') {
            if (this.isHeadless() && this.getWorkspace()) {
                const contextUrl = this.getWorkspace()?.contextURL.replace('prebuild/', '')!;
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
                const wsListener = await this.props.service.listenToInstance(this.props.workspaceId);
                this.setState({
                    wsListener
                });
                const update = () => {
                    if (wsListener.info.latestInstance) {
                        this.onInstanceUpdate(wsListener.info.latestInstance);
                    }
                };
                update();
                wsListener.onDidChange(update);
                this.workspaceInfoReceived = true;
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

        const isError = this.state && !!this.state.errorMessage;
        const startErrorRenderer = this.props.startErrorRenderer;
        if (startErrorRenderer && errorCode) {
            const rendered = startErrorRenderer(errorCode, this.props.service, () => this.startWorkspace(this.props.workspaceId, true, false));
            if (rendered) {
                return rendered;
            }
        }
        
        let message = <div className='message'>Starting...</div>;
        if (!isError && this.state && this.state.workspaceInstance) {
            message = <div className='message'>
                {this.process.getLabel(this.state.workspaceInstance.status.phase)}
            </div>;
            const phase = this.state.workspaceInstance.status.phase;
            if (!this.isHeadless() && (phase === 'stopped' ||
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
                const ctxURL = new URL(this.getWorkspace()?.contextURL || urls.asDashboard().toString())
                const host = "Back to " + ctxURL.host;
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
                                    onClick={() => this.redirectTo(ctxURL.toString())}>{host}</Button>
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
        const isHeadlessBuildRunning = this.isHeadless() && instance && (instance.status.phase === 'running' || instance.status.phase === 'stopping');
        let errorMessage = this.state && this.state.errorMessage;
        if (isBuildingWorkspaceImage) {
            logs = <ShowWorkspaceBuildLogs buildLog={this.state.buildLog} errorMessage={errorMessage} showPhase={!isError} />;
            errorMessage = ""; // errors will be shown in the output already
        } else if (isHeadlessBuildRunning) {
            logs = <WorkspaceLogView content={this.state.headlessLog} />;
            errorMessage = "";
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
        if (this.state && this.state.workspaceInstance && this.state.workspaceInstance.status.phase == 'running') {
            if (this.state.remainingUsageHours !== undefined && this.state.remainingUsageHours <= 0) {
                errorMessage = 'You have run out of Gitpod Hours.';
                message = <div className='message action'>
                    <Button className='button' variant='outlined' color='secondary' onClick={() =>
                        window.open(new GitpodHostUrl(window.location.toString()).asUpgradeSubscription().toString(), '_blank')
                    }>Upgrade Subscription</Button>
                </div>;
            } else if (this.runsInIFrame()) {
                message = <div className='message'></div>;
            } else {
                this.ensureWorkspaceAuth(this.state.workspaceInstance.id)
                    .then(() => { window.location.href = this.state.workspaceInstance!.ideUrl; });
            }
        }

        const showProductivityTips = this.branding ? this.branding.showProductivityTips : false;
        const shouldRenderTips = showProductivityTips && !logs && !isError && this.state.userHasAlreadyCreatedWorkspaces !== undefined && this.runsInIFrame() &&
            !(this.state.workspaceInstance && (this.state.workspaceInstance.status.phase === 'stopping' || this.state.workspaceInstance.status.phase === 'stopped'));
        const productivityTip = shouldRenderTips ? <ProductivityTips userHasCreatedWorkspaces={this.state.userHasAlreadyCreatedWorkspaces} /> : undefined;
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
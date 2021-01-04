/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';

import { CancellationTokenSource } from 'vscode-jsonrpc/lib/cancellation';
import { GitpodService, WorkspaceCreationResult, CreateWorkspaceMode } from '@gitpod/gitpod-protocol';

import { StartWorkspace } from "../start-workspace";
import ShowGenericError from "../show-generic-error";
import ShowNotFoundError from "../show-not-found-error";
import { FeaturedRepositories } from "../repositories";
import { getBlockedUrl } from "../../routing";
import { ApplicationFrame } from "../page-frame";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { ResponseError } from "vscode-jsonrpc";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import ShowUnauthorizedError from "../show-unauthorized-error";
import { RunningWorkspaceSelector } from "../running-workspace-selector";
import { RunningPrebuildView } from "../running-prebuild-view";
import { ShowNoPrivateReposUpgrade } from '../show-no-private-repos-upgrade';
import { WithBranding } from "../with-branding";
import { browserExtension } from "../../browser-extension-detection";
import { Context } from "../../context";

export class CreateWorkspaceProps {
    contextUrl: string;
    createWorkspacePromise: Promise<WorkspaceCreationResult>;
    service: GitpodService;
}
export type CreateErrorRenderer = (error: CreateWorkspaceError, service: GitpodService, retriggerStart: () => void) => JSX.Element | undefined;

export class CreateWorkspaceState {
    createWorkspaceResult?: WorkspaceCreationResult;
    showWhitelistedRepoList?: boolean;
    error?: CreateWorkspaceError;
}

export interface CreateWorkspaceError {
    message?: string;
    code?: number;
    data?: any;
}

export async function getWayoutURL(service: GitpodService): Promise<string> {
    let target: string;
    if (window.location.href.includes("gitpod.io")) {
        target = 'https://www.gitpod.io';
    } else {
        target = '/workspaces/';
    }
    const branding = await WithBranding.getBranding(service);
    if (branding) {
        target = branding.homepage;
    }
    return target;
}

export class CreateWorkspace extends React.Component<CreateWorkspaceProps, CreateWorkspaceState> {

    constructor(props: CreateWorkspaceProps) {
        super(props);
        this.state = {};
        // gather info about used browser
        browserExtension.updatePlatformInformation(this.props.service);
    }

    async componentDidMount() {
        this.fetchState();
    }

    private async fetchState(): Promise<void> {
        await this.doCreateWorkspace(this.props.createWorkspacePromise);
    }

    private async retriggerStart(): Promise<void> {
        await this.doCreateWorkspace(this.props.service.server.createWorkspace({ contextUrl: this.props.contextUrl }));
    }

    protected async doCreateWorkspaceWithMode(mode: CreateWorkspaceMode): Promise<WorkspaceCreationResult | undefined> {
        this.cancelPollWorkspacePrebuild();
        if (mode !== CreateWorkspaceMode.UsePrebuild) {
            /* When we're creating a new workspace explicitly using a prebuild, we might be waiting
             * for the prebuild (polling the DB). In that case we want to keep the appearance of waiting
             * for the prebuild.
             */
            this.setState({ createWorkspaceResult: {} });
        }
        const result = await this.doCreateWorkspace(this.props.service.server.createWorkspace({ contextUrl: this.props.contextUrl, mode }).catch());
        if (result && result.runningWorkspacePrebuild) {
            const pwsid = result.runningWorkspacePrebuild.prebuildID;
            this.pollWorkspacePrebuild(pwsid);
        }

        return result;
    }

    protected async doCreateWorkspace(createPromise: Promise<WorkspaceCreationResult>): Promise<WorkspaceCreationResult | undefined> {
        try {
            const createWorkspaceResult = await createPromise;
            this.setState({ createWorkspaceResult, error: undefined });
            return createWorkspaceResult;
        } catch (e) {
            if (e && e instanceof Error) {
                await this.handleErrorDuringMount(e);
            }
        }
        return;
    }

    private pollWorkspacePrebuildTokenSource: CancellationTokenSource | undefined;
    private async pollWorkspacePrebuild(prebuildID: string): Promise<void> {
        this.cancelPollWorkspacePrebuild();
        this.pollWorkspacePrebuildTokenSource = new CancellationTokenSource();
        const token = this.pollWorkspacePrebuildTokenSource.token;
        let available = false;
        while (!available && !token.isCancellationRequested) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            if (token.isCancellationRequested) {
                return;
            }
            available = await this.props.service.server.isPrebuildDone(prebuildID);
        }
        if (available) {
            this.doCreateWorkspaceWithMode(CreateWorkspaceMode.UsePrebuild);
        }
    }
    private cancelPollWorkspacePrebuild(): void {
        if (this.pollWorkspacePrebuildTokenSource) {
            this.pollWorkspacePrebuildTokenSource.cancel();
            this.pollWorkspacePrebuildTokenSource = undefined;
        }
    }

    protected async handleErrorDuringMount(e: Error) {
        if (e instanceof ResponseError) {
            const code = e.code;
            const data = e.data;
            switch (code) {
                case ErrorCodes.USER_BLOCKED:
                    window.location.href = getBlockedUrl();
                    return;
                case ErrorCodes.SETUP_REQUIRED:
                    window.location.href = new GitpodHostUrl(window.location.toString()).with({ pathname: "first-steps" }).toString();
                    return;
                case ErrorCodes.USER_TERMS_ACCEPTANCE_REQUIRED:
                    const thisUrl = window.location.toString();
                    window.location.href = new GitpodHostUrl(thisUrl).withApi({ pathname: "/tos", search: `mode=update&returnTo=${encodeURIComponent(thisUrl)}` }).toString();
                    return;
                case ErrorCodes.NOT_AUTHENTICATED:
                    if (data) {
                        this.setState({
                            error: {
                                message: e.toString(),
                                data,
                                code
                            }
                        });
                    } else {
                        let url = await getWayoutURL(this.props.service);
                        if (this.props.contextUrl) {
                            url = new GitpodHostUrl(window.location.toString()).withApi({
                                pathname: '/login/',
                                search: 'returnTo=' + encodeURIComponent(window.location.toString())
                            }).toString();
                        }
                        window.location.href = url;
                    }
                    return;
                case ErrorCodes.REPOSITORY_NOT_WHITELISTED:
                    this.setState({ showWhitelistedRepoList: true });
                    return;
                case ErrorCodes.CONTEXT_PARSE_ERROR:
                case ErrorCodes.NOT_FOUND:
                default:
                    this.setState({
                        error: {
                            message: e.toString(),
                            data,
                            code
                        }
                    });
                    return;
            }
        }
        this.setState({ error: { message: e.toString() } });
    }

    protected renderError(error: CreateWorkspaceError, renderer: CreateErrorRenderer | undefined) {
        if (renderer) {
            const rendered = renderer(error, this.props.service, () => this.retriggerStart());
            if (rendered) {
                return rendered;
            }
        }

        const data = error.data;
        const code = error.code;
        if (code === ErrorCodes.NOT_FOUND) {
            if (data.owner && data.repoName) {
                return (
                    <ApplicationFrame service={this.props.service}>
                        <ShowNotFoundError data={data} service={this.props.service} />
                    </ApplicationFrame>
                );
            }
        }
        if (code === ErrorCodes.SETUP_REQUIRED) {
            return <ApplicationFrame />;
        }
        if (code === ErrorCodes.USER_TERMS_ACCEPTANCE_REQUIRED) {
            return <ApplicationFrame />;
        }
        if (code === ErrorCodes.NOT_AUTHENTICATED) {
            if (data.host && data.scopes && data.messageHint) {
                return (
                    <ApplicationFrame service={this.props.service}>
                        <ShowUnauthorizedError data={data} />
                    </ApplicationFrame>
                );
            }
            console.log(data);
        }
        if (code === ErrorCodes.PLAN_DOES_NOT_ALLOW_PRIVATE_REPOS) {
            return (
                <ApplicationFrame service={this.props.service}>
                    <ShowNoPrivateReposUpgrade />
                </ApplicationFrame>
            );
        }
        let showNewIssueLink = true;
        let heading = undefined;
        switch (code) {
            case (ErrorCodes.CONTEXT_PARSE_ERROR): {
                heading = `We are having trouble parsing your context`;
                break;
            }
            default: {
                heading = undefined;
            }
        }
        return (
            <ApplicationFrame service={this.props.service}>
                <ShowGenericError heading={heading} errorMessage={error.message} showNewIssueLink={showNewIssueLink} />
            </ApplicationFrame>
        );
    }

    render() {
        const {
            error,
            showWhitelistedRepoList,
            createWorkspaceResult,
        } = this.state;
        if (error) {
            return (
                <Context.Consumer>
                    {(ctx) => this.renderError(error, ctx.renderCreateError)}
                </Context.Consumer>
            )
        }
        if (showWhitelistedRepoList) {
            return (
                <ApplicationFrame service={this.props.service}>
                    <h3 className="heading">The repository you are trying to use will become available once we are out of the beta phase.</h3>
                    <p>Until then, please try Gitpod with one of the repositories below:</p>
                    <Context.Consumer>
                        {(ctx) =>
                            <FeaturedRepositories
                                service={this.props.service}
                                disableActions={ctx.disabledActions} />
                        }
                    </Context.Consumer>
                </ApplicationFrame>
            );
        }
        if (createWorkspaceResult) {
            if (createWorkspaceResult.workspaceURL) {
                window.location.href = createWorkspaceResult.workspaceURL;
                return;
            }
            if (createWorkspaceResult.createdWorkspaceId) {
                return <StartWorkspace workspaceId={createWorkspaceResult.createdWorkspaceId} service={this.props.service} />;
            }
            if (createWorkspaceResult.existingWorkspaces) {
                return (
                    <ApplicationFrame service={this.props.service}>
                        <Context.Consumer>
                            {(ctx) =>
                                <RunningWorkspaceSelector
                                    service={this.props.service}
                                    disableActions={ctx.disabledActions}
                                    contextUrl={this.props.contextUrl}
                                    existingWorkspaces={createWorkspaceResult.existingWorkspaces!}
                                    createNewWorkspace={() => this.doCreateWorkspaceWithMode(CreateWorkspaceMode.Default)}
                                    requestUpdate={() => this.fetchState()} />
                            }
                        </Context.Consumer>
                    </ApplicationFrame>
                );

            }
            if (createWorkspaceResult.runningWorkspacePrebuild) {
                const runningPrebuild = createWorkspaceResult.runningWorkspacePrebuild;
                return (
                    <RunningPrebuildView
                        service={this.props.service}
                        prebuildingWorkspaceId={runningPrebuild.workspaceID}
                        justStarting={runningPrebuild.starting}
                        onWatchPrebuild={() => this.doCreateWorkspaceWithMode(CreateWorkspaceMode.UsePrebuild)}
                        onIgnorePrebuild={() => this.doCreateWorkspaceWithMode(CreateWorkspaceMode.ForceNew)} />
                );
            }
        }

        // render the cube animation/extension and browser warning
        return <StartWorkspace service={this.props.service} />;
    }

}

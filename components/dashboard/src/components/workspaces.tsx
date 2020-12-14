/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Workspace, WorkspaceInfo, WorkspaceInstance, DisposableCollection, WhitelistedRepository, GitpodServer, GitpodService, Configuration } from '@gitpod/gitpod-protocol';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import Grid from '@material-ui/core/Grid';
import Input from '@material-ui/core/Input';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import WorkspaceEntry from './workspace-entry';
import withRoot from '../withRoot';
import { ResponseError } from 'vscode-jsonrpc';
import RepositoryEntry from './repository-entry';
import Fade from '@material-ui/core/Fade';
import { getBlockedUrl } from '../routing';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { getGitpodConfiguration } from '../configuration';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';

interface WorkspacesProps {
	searchText?: string;
    service: GitpodService;
    
    disableActions?: boolean;
}

interface WorkspacesState {
    notAuthorized?: boolean;
	workspaces?: WorkspaceInfo[];
	limit?: number;
	showPinnedOnly?: boolean;
    hasPinnedWorkspaces?: boolean;
	searchString?: string;
	featuredRepositories?: WhitelistedRepository[];
    configuration?: Configuration;
}

class Workspaces extends React.Component<WorkspacesProps, WorkspacesState> {
    private disposables = new DisposableCollection();
    
    constructor(p: WorkspacesProps) {
        super(p);
        this.state = {};
        getGitpodConfiguration().then(configuration => this.setState({ configuration }));
    }

	componentWillMount() {
		this.updateWorkspaces();
        this.listenForInstanceUpdates();

		this.props.service.server.getFeaturedRepositories()
			.then(repos => this.setState({ featuredRepositories: repos }))
			.catch( /* We did not get our repos. UX is slightly degraded as the featured repos are not shown. */ );
	}

	componentWillUnmount() {
		this.disposables.dispose();
	}

	private async updateWorkspaces(options?: GitpodServer.GetWorkspacesOptions) {
		try {
			const workspaces = await this.props.service.server.getWorkspaces({
				limit: this.getLimit(),
				searchString: this.getSearchString(),
				pinnedOnly: this.state.showPinnedOnly || false,
				...options
			});
            const hasPinnedWorkspaces = await this.hasPinnedWorkspaces();
			this.setState({ workspaces, hasPinnedWorkspaces });
		} catch (err) {
            log.error(err);
            this.setState({ workspaces: [] });
            if (err instanceof ResponseError) {
                switch (err.code) {
                    case ErrorCodes.SETUP_REQUIRED:
                        window.location.href = new GitpodHostUrl(window.location.toString()).with({ pathname: "first-steps" }).toString();
                        return;
                    case ErrorCodes.NOT_AUTHENTICATED:
                        this.setState({ notAuthorized: true });
                        return;
                    case ErrorCodes.USER_BLOCKED:
                        window.location.href = getBlockedUrl();
                        return;
					default:
						return;
                }
			}
		}
    }
    
    private async hasPinnedWorkspaces(): Promise<boolean> {
        return this.props.service.server.getWorkspaces({limit: 1, pinnedOnly: true}).then(x => x.length > 0);
    }

	private getLimit() {
		return this.state && this.state.limit || 10;
	}

	private toggleShowPinnedOnly = () => {
		this.setState(s => {
			const showPinnedOnly = !s.showPinnedOnly;
			this.updateWorkspaces({ pinnedOnly: showPinnedOnly });
			return { showPinnedOnly };
		});
	}

	private getSearchString() {
		return this.state && this.state.searchString;
	}

	private onSearchChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
		const searchString = evt.target.value;
		this.updateWorkspaces({
			searchString
		});
		this.setState( s => {
			return {
				searchString
			};
		});
	}

	private listenForInstanceUpdates() {
		const onInstanceUpdate = async (instance: WorkspaceInstance) => {
			this.setState(state => {
				if (!state || !state.workspaces) {
					return {};
				}
				for (const info of state.workspaces) {
					if (info.workspace.id === instance.workspaceId) {
                        info.latestInstance = instance;

						return state;
					}
				}
				return {};
			});
		};
		const removeListener = this.props.service.registerClient({
			onInstanceUpdate,
			onWorkspaceImageBuildLogs: () => { /* do nothing */ },
            onHeadlessWorkspaceLogs: () => { /* do nothing */ }
		});
		this.disposables.push(removeListener);
	}

	private handleTogglePinned = async (ws: Workspace) => {
        await this.props.service.server.updateWorkspaceUserPin(ws.id, "toggle")
        this.updateWorkspaces();
	};

    private handleWorkspaceDeleted = async (ws: Workspace) => {
        this.updateWorkspaces();
    }

	private handleToggleShareable = async (ws: Workspace) => {
        try {
            await this.props.service.server.controlAdmission(ws.id, ws.shareable ? "owner" : "everyone");
        } catch (e) {
            this.setState(() => {throw e});
        }
		this.updateWorkspaces();
    };

	render() {
		if (!this.state || this.state.notAuthorized) {
            return <Fade in={true}>
                <Grid container spacing={8} className="workspace-list" style={{ marginTop: "40px" }}>
                    <Grid item xs={12}>
                        <Paper style={{ padding: "20px", textAlign: "center", fontStyle: "italic" }}>
                            Please log in to see your workspaces here.
                        </Paper>
                    </Grid>
                </Grid>
            </Fade>
		} else if (!this.state.workspaces) {
			return this.renderSkeleton();
		}

		let workspacesRows: JSX.Element[] = (this.state.workspaces || []).map(ws => {
				return (
					<Grid
						item
						key={ws.workspace.id}
						xs={12}>
						<WorkspaceEntry
							workspace={ws.workspace}
							currentInstance={ws.latestInstance}
							service={this.props.service}
							handleTogglePinned={this.handleTogglePinned}
                            handleToggleShareable={this.handleToggleShareable}
                            handleWorkspaceDeleted={this.handleWorkspaceDeleted}
							disabled={!!this.props.disableActions}
							/>
					</Grid>
				);
            });
        if (workspacesRows.length === 0 && this.getSearchString()) {
            workspacesRows.push(
                <Grid
                    item
                    xs={12}>
                    <Paper style={{ padding: "10px 40px" }}>
                        <p style={{ fontStyle: "italic" }}>No workspaces found for search '{this.getSearchString()}'.</p>
                    </Paper>
                </Grid>
            );
        }
		if (workspacesRows.length === 0 && !this.getSearchString()) {
			workspacesRows = [(
				<Grid
					item
					xs={12}>
					<Paper style={{ padding: 30 }}>
						<Typography variant="subheading">
							<div>
								No workspaces found. <a href="https://www.gitpod.io/docs/getting-started/" target="_blank">How do I create a new workspace?</a>
							</div>
						</Typography>
					</Paper>
				</Grid>
			)];
		}

		let featuredRepositories: JSX.Element | undefined = undefined;
		if (this.state.featuredRepositories && this.state.featuredRepositories!.length > 0 && this.state.workspaces!.length === 0) {
			featuredRepositories = (
				<Grid item xs={12} style={{ paddingTop: '1em' }}>
					<div style={{ paddingBottom: '0.5em' }}><small>If you want to create a workspace, you could have a look at one of the repositories featured below:</small></div>
					{this.state.featuredRepositories!.map(repo => <RepositoryEntry key={repo.name} repository={repo} disabled={!!this.props.disableActions} />)}
				</Grid>
			);
		}

		let limitOptions: JSX.Element[] = [];
		for (const limit of [10, 50, 100]) {
			if (this.getLimit() === limit) {
				limitOptions.push(<a key={'_' + limit}>{limit}</a>);
			} else {
				limitOptions.push((
					<a
						key={'_' + limit}
						className='active'
						onClick={() => {
							this.setState(s => {
								this.updateWorkspaces({ limit });
								return { limit };
							});
						}}>{limit}</a>
				));
			}
        }

        let gcMessage;
        if (workspacesRows.length > 0 && this.state.configuration) {
            gcMessage = (
                <Grid item xs={12}>
                    <Paper className="gc-message">
                        <Typography component="p" >
                            Unused workspaces are automatically deleted after {this.state.configuration.daysBeforeGarbageCollection} days of inactivity. <a href="https://www.gitpod.io/docs/life-of-workspace/#garbage-collection">Learn more.</a>
                        </Typography>
                    </Paper>
                </Grid>
            );
        }

        const searchString = (this.state.searchString || "").trim();
        const showSearchBar = searchString !== "" || this.state.workspaces!.length > 0;

		return (
			<Fade in={true}>
				<Grid container spacing={8} className="workspace-list">
                    {gcMessage}
                    <Grid item xs={12} className="search" style={showSearchBar ? {} : {display: "none"}}>
                        <Input placeholder="Search" aria-label="Search" className="input" defaultValue={this.state.searchString} onChange={this.onSearchChange}/>
						<div className="limit">
							<a
								className='active'
								onClick={this.toggleShowPinnedOnly}
                                style={!!this.state.hasPinnedWorkspaces ? {} : {display: "none"}}>
								{!!this.state.showPinnedOnly ? 'show all workspaces' : 'show pinned workspaces only'}
							</a>
							{limitOptions}
						</div>
					</Grid>
					{workspacesRows}
					{featuredRepositories}
				</Grid>
			</Fade>
		);
	}

	protected renderSkeleton() {
		return (
            <Grid container spacing={8} className="workspace-list">
			<Grid item xs={12} className="search">
				<div className="loading-skeleton dummy" style={{ minWidth: "20em" }}></div>
				<div className="limit">
					<div className="loading-skeleton dummy" style={{ minWidth: "20em" }}></div>
				</div>
			</Grid>
			<Grid
				item
				xs={12}>
				<Paper style={{ padding: 50 }} className="loading-skeleton">
				</Paper>
			</Grid>
            </Grid>
        );
	}
}

export default withRoot(Workspaces);

/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Workspace, WorkspaceInstance, GitpodService, WorkspaceInstancePhase, Configuration } from '@gitpod/gitpod-protocol';
import * as moment from 'moment';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Input from '@material-ui/core/Input';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
const Pin = require('../../public/images/pin.svg');
import Public from '@material-ui/icons/LockOpen';
import Private from '@material-ui/icons/Lock';
import Edit from '@material-ui/icons/Edit';
import Check from '@material-ui/icons/Check';
import Cancel from '@material-ui/icons/Cancel';
import Delete from '@material-ui/icons/Delete';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';

import 'octicons/build/build.css';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import IconDetail from './icon-detail';
import { getGitpodConfiguration } from '../configuration';

const repositoryIcon: string = require('octicons/build/svg/repo.svg');
const pullRequest: string = require('octicons/build/svg/git-pull-request.svg');
const issue: string = require('octicons/build/svg/issue-opened.svg');
const gitBranch: string = require('octicons/build/svg/git-branch.svg');
const gitCommit: string = require('octicons/build/svg/git-commit.svg');

interface EditableDescriptionProps {
    workspace: Workspace;
    service: GitpodService;
}

interface EditableDescriptionState {
    editDescription: boolean;
    description: string;
}

class EditableDescription extends React.Component<EditableDescriptionProps, EditableDescriptionState> {

    protected newDescription: string;

    constructor(props: EditableDescriptionProps) {
        super(props);

        this.state = {
            editDescription: false,
            description: this.props.workspace.description
        };
        this.newDescription = this.props.workspace.description;
    }

    protected isEmpty(): boolean {
        return this.newDescription.trim() === '';
    }

    protected readonly handleEnter = () => this.doHandleEnter();
    protected doHandleEnter() {
        if (!this.isEmpty()) {
            this.props.service.server.setWorkspaceDescription({
                desc: this.newDescription,
                workspaceId: this.props.workspace.id,
            });
            this.setState({
                editDescription: !this.state.editDescription,
                description: this.newDescription
            });
        } else {
            this.doToggleEditMode();
        }
    }

    protected readonly toggleEditMode = () => this.doToggleEditMode();
    protected doToggleEditMode() {
        this.setState({ editDescription: !this.state.editDescription });
    }

    protected readonly handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => this.doHandleKeyUp(e);
    protected doHandleKeyUp(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            this.doHandleEnter();
        } else if (e.key === "Escape") {
            this.doToggleEditMode();
        }
    }

    protected readonly handleChange = (e: React.ChangeEvent<HTMLInputElement>) => this.doHandleChange(e);
    protected doHandleChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.newDescription = e.target.value;
        this.forceUpdate();
    }

    render() {
        return <Grid container className="editable-description">
            <Grid item xs={10} className="description-field">
                {
                    this.state.editDescription ?
                        <Input defaultValue={this.state.description} fullWidth={true} autoFocus={true}
                            inputProps={
                                {
                                    'maxlength': 255
                                }
                            }
                            className='description-input'
                            classes={{ root: `${!this.isEmpty() ? 'inherit' : 'error'}`, focused: "focused" }}
                            onChange={this.handleChange}
                            onKeyUp={this.handleKeyUp}>
                        </Input>
                        :
                        <Typography
                            variant="headline"
                            component="h3"
                            style={{ flexGrow: 1, overflowWrap: 'break-word', width: '100%' }}
                            onClick={this.toggleEditMode}>
                            {this.state.description}
                        </Typography>
                }
            </Grid>
            <Grid item xs={2} className="edit-buttons">
                {
                    this.state.editDescription ?
                        <React.Fragment>
                            <IconButton onClick={this.handleEnter} title="Save">
                                <Check classes={{ root: `${!this.isEmpty() ? "check" : "disabled"}` }} />
                            </IconButton>
                            <IconButton onClick={this.toggleEditMode} title="Cancel">
                                <Cancel classes={{
                                    root: "cancel"
                                }} />
                            </IconButton>
                        </React.Fragment>
                        :
                        <IconButton className="edit-button" onClick={this.toggleEditMode} title="Edit description">
                            <Edit />
                        </IconButton>
                }
            </Grid>
        </Grid>;
    }
}

interface WorkspaceEntryProps {
    workspace: Workspace;
    currentInstance?: WorkspaceInstance;
    handleTogglePinned: (ws: Workspace) => void;
    handleToggleShareable: (ws: Workspace) => void;
    handleWorkspaceDeleted: (ws: Workspace) => void;
    service: GitpodService;
    disabled: boolean;
}

interface WorkspaceEntryState {
    deletionDialogOpen: boolean;
    showRepoInfo: boolean;
    hasSnaphots?: boolean;
    configuration?: Configuration;
}

export default class WorkspaceEntry extends React.Component<WorkspaceEntryProps, WorkspaceEntryState> {

    constructor(props: WorkspaceEntryProps) {
        super(props)
        this.state = {
            deletionDialogOpen: false,
            showRepoInfo: false,
        };
        getGitpodConfiguration().then(configuration => this.setState({ configuration }));
    }

    handleTogglePinned = () => {
        return this.props.handleTogglePinned(this.props.workspace);
    }

    handleToggleShareable = () => {
        return this.props.handleToggleShareable(this.props.workspace);
    }

    handleStop = () => {
        this.props.service.server.stopWorkspace({workspaceId: this.props.workspace.id});
    }

    deleteWorkspace = async () => {
        try {
            if (!this.state || this.state.hasSnaphots === undefined) {
                const snapshots = await this.props.service.server.getSnapshots({workspaceId: this.props.workspace.id});
                this.setState({ hasSnaphots: snapshots.length > 0 });
            }

            this.setState({ deletionDialogOpen: true });
        } catch (err) {
            console.log(err);
            alert("Could not delete your workspace - please try again or contact support")
        }
    }

    doDeleteWorkspace = async () => {
        try {
            await this.props.service.server.deleteWorkspace({workspaceId: this.props.workspace.id});
            this.props.handleWorkspaceDeleted(this.props.workspace);
        } catch (err) {
            console.log(err);
            alert("Could not delete your workspace - please try again or contact support")
        }

        this.setState({ deletionDialogOpen: false });
    }

    render(): React.ReactNode {
        const buttons: JSX.Element[] = [];
        let status: WorkspaceInstancePhase = this.props.currentInstance && this.props.currentInstance.status.phase || 'stopped';

        const startTooltip = "Start and open the workspace";
        const stopTooltip = "Stop the workspace";
        const openTooltip = "Open the already running workspace";
        const downloadTooltip = "Download the files of the workspace";

        if (status === 'stopped') {
            const downloadURL = new GitpodHostUrl(window.location.href).with({ pathname: `/workspace-download/get/${this.props.workspace.id}` }).toString();
            buttons.push(
                <Button key='stop' className='button' variant='outlined' color='primary' href={downloadURL} title={downloadTooltip}>
                    Download
                </Button>
            )
            const startUrl = new GitpodHostUrl(window.location.href).with({
                pathname: '/start/',
                hash: '#' + this.props.workspace.id
            }).toString();
            buttons.push((
                <Button key='start' className='button' variant='outlined' color='secondary' href={startUrl} target='_blank' disabled={this.props.disabled} title={startTooltip}>
                    Start
                </Button>
            ));
        } else if (status === 'running') {
            buttons.push((
                <Button key='stop' className='button' variant='outlined' color='primary' 
                    onClick={() => this.props.service.server.stopWorkspace({workspaceId: this.props.workspace.id})} 
                    title={stopTooltip}>
                    Stop
                </Button>
            ));
            buttons.push((
                <Button key='open' className='button' variant='outlined' color='secondary' href={this.props.currentInstance!.ideUrl} target='_blank' disabled={this.props.disabled} title={openTooltip}>
                    Open
                </Button>
            ));
        } else if (status == 'stopping') {
            // if the workspace is stopping, opening it or stopping again doesn't make sense
            buttons.push(<Button key='stop' className='button' variant='outlined' color='primary' title={stopTooltip} disabled>Stop</Button>)
            buttons.push(<Button key='open' className='button' variant='outlined' color='secondary' title={openTooltip} disabled>Open</Button>)
        } else {
            buttons.push((
                <Button key='open' className='button' variant='outlined' color='secondary' target='_blank' 
                    href={this.props.currentInstance!.ideUrl} 
                    disabled={this.props.disabled || !this.props.currentInstance!.ideUrl}
                    title={openTooltip}>
                    Open
                </Button>
            ));
        }

        let errorMessage;
        let statusMessage = '';
        let bottomMessage = '';
        if (this.props.currentInstance) {
            errorMessage = this.props.currentInstance && this.props.currentInstance.status.conditions.failed || undefined;
            const stopped = this.props.currentInstance.stoppedTime;
            let time = '';
            if (stopped && status === 'stopped') {
                time = `Last run ${moment(new Date(stopped)).fromNow()}`;
                statusMessage = time;
            } else {
                const started = this.props.currentInstance.creationTime;
                if (started) {
                    time = `Started ${moment(new Date(started)).fromNow()}`;
                }
                const capitalizedStatus = status.charAt(0).toUpperCase() + status.slice(1);
                statusMessage = `${capitalizedStatus} - ${time}`;
            }
            bottomMessage = errorMessage ? `${statusMessage}: ${errorMessage}` : `${statusMessage}.`;
        }

        if (this.state.configuration && !this.props.workspace.pinned) {
            const milliSecsBeforeGC = this.state.configuration.daysBeforeGarbageCollection * 24 * 60 * 60 * 1000;
            let deletionDate = this.state.configuration.garbageCollectionStartDate;
            if (this.props.currentInstance && this.props.currentInstance.stoppedTime) {
                const theoreticalDeletionDate = new Date(this.props.currentInstance.stoppedTime).getTime() + milliSecsBeforeGC;
                if (theoreticalDeletionDate > deletionDate) {
                    deletionDate = theoreticalDeletionDate;
                }
                if (deletionDate - Date.now() < (milliSecsBeforeGC / 2)) {
                    if (deletionDate > Date.now()) {
                        bottomMessage = `Scheduled for deletion ${moment(Math.max(deletionDate, 0)).fromNow()}. Pin the workspace on the top left to keep it.`
                    } else {
                        bottomMessage = `Will be deleted soon. Pin the workspace on the top left to keep it.`
                    }
                }
            }
        }
            
        const repo = this.props.currentInstance && this.props.currentInstance.status && this.props.currentInstance.status.repo;
        const latestBranchName = repo && repo.branch;
        const latestCommit = repo && repo.latestCommit;

        let pendingChangesMsg = "";
        if (repo) {
            const plurals = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine' };
            const pluralise = (n: number, noun: string) => `${plurals[n] || n} ${noun}${n > 1 ? 's' : ''}`;

            let pendingChanges: string[] = [];

            const gitpodProtocolDoesNotProvideTotalChanges = repo.totalUncommitedFiles == undefined && repo.totalUntrackedFiles == undefined && repo.totalUnpushedCommits == undefined;
            if (gitpodProtocolDoesNotProvideTotalChanges) {
                // we have an old workspace that does not provide the total changes via Gitpod protocol
                if (repo.uncommitedFiles || repo.untrackedFiles) {
                    const number = (repo.uncommitedFiles ? repo.uncommitedFiles.length : 0) + (repo.untrackedFiles ? repo.untrackedFiles.length : 0);
                    // since we truncate at 100 entries and add '.. and XXX more' it's likely that there are more changes if number > 100
                    pendingChanges.push(number > 100 ? 'at least 100 pending changes' : pluralise(number, 'pending change'));
                }
                if (repo.unpushedCommits) {
                    const number = repo.unpushedCommits.length;
                    // since we truncate at 100 entries and add '.. and XXX more' it's likely that there are more changes if number > 100
                    pendingChanges.push(number > 100 ? 'at least 100 unpushed commits' : pluralise(number, 'unpushed commit'));
                }
            } else {
                if (repo.totalUncommitedFiles || repo.totalUntrackedFiles) {
                    const number = (repo.totalUncommitedFiles || 0) + (repo.totalUntrackedFiles || 0);
                    pendingChanges.push(pluralise(number, 'pending change'));
                }
                if (repo.totalUnpushedCommits) {
                    pendingChanges.push(pluralise(repo.totalUnpushedCommits, 'unpushed commit'));
                }
            }

            if (pendingChanges.length == 1) {
                pendingChangesMsg = `Workspace has ${pendingChanges[0]}`;
            } else if (pendingChanges.length > 1) {
                pendingChangesMsg = `Workspace has ${pendingChanges.slice(0, pendingChanges.length - 1).join(', ')} and ${pendingChanges[pendingChanges.length - 1]}`;
            }
        }

        const pullRequestNumber = Workspace.getPullRequestNumber(this.props.workspace);
        const issueNumber = Workspace.getIssueNumber(this.props.workspace);
        return <React.Fragment>
            <Dialog open={this.state.deletionDialogOpen}>
                <DialogTitle>Delete workspace</DialogTitle>
                <DialogContent>
                    <Typography variant="body1">
                        <strong>Warning:</strong>  This action is irreversible! Deleting a workspace will remove all its backups and snapshots. Once a workspace is deleted <b>it cannot be restored</b>.
                    </Typography>
                    { this.state && this.state.hasSnaphots && <Typography variant="body1"><br />This workspace has snapshots. Beware that deleting this workspace will also delete its snapshots.</Typography> }
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => this.setState({deletionDialogOpen: false})} color="primary" variant="outlined">Cancel</Button>
                    <Button onClick={this.doDeleteWorkspace} color="secondary" variant="outlined" autoFocus>Do it!</Button>
                </DialogActions>
            </Dialog>
            <Paper className={'workspace-details ' + (errorMessage ? 'error' : status)} style={{ borderLeftWidth: 3 }}>
                <Grid container className='stage'>
                    <Grid item xs={1} className='fav-column'>
                        <div onClick={this.handleTogglePinned}
                            className={'fav' + (this.props.workspace.pinned ? ' active' : '')}
                            dangerouslySetInnerHTML={{ __html: Pin }} />
                        <div
                            title={this.props.workspace.shareable ? 'Stop Sharing' : 'Share'}
                            onClick={this.handleToggleShareable}
                            className={'fav' + (this.props.workspace.shareable ? ' active' : '')}>
                            {this.props.workspace.shareable ? <Public style={{ fontSize: 40 }} /> : <Private style={{ fontSize: 40 }} />}
                        </div>
                        <div
                            title="Delete"
                            onClick={this.deleteWorkspace}
                            className='fav'>
                            <Delete style={{ fontSize: 40 }} />
                        </div>
                    </Grid>
                    <Grid item xs={11} className='main'>
                        <Grid container>
                            <Grid item xs={12}>
                                <Typography variant="caption">
                                    {this.props.workspace.id}
                                </Typography>
                            </Grid>
                            <Grid item xs={10} className='title'>
                                <EditableDescription service={this.props.service} workspace={this.props.workspace} />
                            </Grid>
                            <Grid item xs={2} style={{ textAlign: 'right' }} className='creation-time'>
                                <Typography>
                                    Created {moment(new Date(this.props.workspace.creationTime)).fromNow()}
                                </Typography>
                            </Grid>
                            <Grid item xs={4}>
                                <IconDetail
                                    text={Workspace.getFullRepositoryName(this.props.workspace)}
                                    iconSrc={repositoryIcon}
                                    link={Workspace.getFullRepositoryUrl(this.props.workspace)}
                                />
                            </Grid>
                            <Grid item xs={8}>
                                {pullRequestNumber ? (
                                    <IconDetail
                                        text={(this.props.workspace.contextURL.toLowerCase().indexOf('gitlab') !== -1 ? 'Merge' : 'Pull')+' Request ' + pullRequestNumber}
                                        iconSrc={pullRequest}
                                        link={this.props.workspace.contextURL}
                                    />
                                ) : <div />
                                }
                                {issueNumber ? (
                                    <IconDetail
                                        text={'Issue ' + issueNumber}
                                        iconSrc={issue}
                                        link={this.props.workspace.contextURL}
                                    />
                                ) : <div />
                                }
                            </Grid>
                            <Grid item xs={4}>
                                <IconDetail
                                    text={latestBranchName || Workspace.getBranchName(this.props.workspace)}
                                    iconSrc={gitBranch}
                                    link={Workspace.getFullRepositoryUrl(this.props.workspace) + '/tree/' + (latestBranchName || Workspace.getBranchName(this.props.workspace))}
                                />
                            </Grid>
                            <Grid item xs={8}>
                                <IconDetail
                                    text={latestCommit || Workspace.getCommit(this.props.workspace)}
                                    iconSrc={gitCommit}
                                    link={Workspace.getFullRepositoryUrl(this.props.workspace) + '/commits/' + (latestCommit || Workspace.getCommit(this.props.workspace))}
                                />
                            </Grid>
                            <Grid item xs={8} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Typography>
                                    {bottomMessage}
                                </Typography>
                            </Grid>
                            <Grid item xs={4} style={{ textAlign: 'right' }}>
                                {buttons}
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
                {this.props.currentInstance && this.props.currentInstance.status && this.props.currentInstance && this.props.currentInstance.status.repo && pendingChangesMsg &&
                    <Grid container className="repo">
                        <Grid item xs={1}>
                            <IconButton onClick={() => this.setState({showRepoInfo: !this.state.showRepoInfo})}>
                            { this.state.showRepoInfo && <ExpandLess className="head" /> }
                            { !this.state.showRepoInfo && <ExpandMore className="head" /> }
                            </IconButton>
                        </Grid>
                        <Grid item xs={11} className="pending-desc">
                            <Typography className="head" onClick={() => this.setState({showRepoInfo: !this.state.showRepoInfo})}>{pendingChangesMsg}</Typography>
                        </Grid>
                        <Grid item xs={12} style={{display: this.state.showRepoInfo ? "" : "none"}} className="pending-changes">
                            <Grid container>
                            {
                                (this.props.currentInstance.status.repo.uncommitedFiles ||
                                this.props.currentInstance.status.repo.untrackedFiles) &&
                                <Grid item xs={this.props.currentInstance.status.repo.unpushedCommits ? 8 : 12}>
                                    {this.props.currentInstance.status.repo.uncommitedFiles &&
                                    <div>
                                        <b>Uncommitted Files</b>
                                        <List dense>
                                            { this.props.currentInstance.status.repo.uncommitedFiles.map((e, i) =>
                                                <ListItem key={i}><ListItemText primary={e} /></ListItem>
                                            )}
                                        </List>
                                    </div>}
                                    {this.props.currentInstance.status.repo.untrackedFiles && <div>
                                        <b>Untracked Files</b>
                                        <List dense>
                                            { this.props.currentInstance.status.repo.untrackedFiles.map((e, i) =>
                                                <ListItem key={i}><ListItemText primary={e} /></ListItem>
                                            )}
                                        </List>
                                    </div>}
                                </Grid>
                            }
                            {this.props.currentInstance.status.repo.unpushedCommits &&
                                <Grid item xs={4}>
                                    <b>Unpushed Commits</b>
                                    <List dense>
                                        { this.props.currentInstance.status.repo.unpushedCommits.map((e, i) =>
                                            <ListItem key={i}><ListItemText primary={e} /></ListItem>
                                        )}
                                    </List>
                                </Grid>
                            }
                            </Grid>
                        </Grid>
                    </Grid>
                }
            </Paper>
        </React.Fragment>
    }
}

/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as React from 'react';
import { GitpodService, User, Permissions, RoleOrPermission, NamedWorkspaceFeatureFlag } from '@gitpod/gitpod-protocol';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Avatar from "@material-ui/core/Avatar";
import { WorkspacesView } from "./workspaces-view";
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { SelectRoleOrPermissionDialog } from './select-role-dialog';
import { SelectWorkspaceFeatureFlagDialog } from './select-feature-flag-dialog';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';

export interface UserViewProps {
    service: GitpodService;
    userID: string;

    renderAdditionalUserProperties?: AdditionalUserPropertiesRenderer;
}
export type AdditionalUserPropertiesRenderer = (service: GitpodService, user: User | undefined) => JSX.Element;

interface UserViewState {
    user?: User;
    ourself?: boolean;

    blockingOp: boolean;
    addingRoleOp: 'none' | 'choose' | 'working';
    addingFeatureFlagOp: 'none' | 'choose' | 'working';
}

interface DetailRowSpec {
    name: string;
    actions?: (u: User) => JSX.Element;
    render?: (u: User) => any;
}

export class UserView extends React.Component<UserViewProps, UserViewState> {

    constructor(props: UserViewProps) {
        super(props);
        this.state = {
            blockingOp: false,
            addingRoleOp: 'none',
            addingFeatureFlagOp: 'none'
        };
    }

    async componentDidMount() {
        try {
            const loggedInUser = await this.props.service.server.getLoggedInUser({});
            const [ user ] = await Promise.all([
                this.props.service.server.adminGetUser({id: this.props.userID})
            ]);
            this.setState({user, ourself: loggedInUser.id === this.props.userID});
        } catch (err) {
            var rerr: ResponseError<any> = err;
            if (rerr.code === ErrorCodes.PERMISSION_DENIED) {
                window.location.href = new GitpodHostUrl(window.location.toString()).asDashboard().toString();
            }

            // TODO: improve error handling
            console.log(err);
            throw err;
        }
    }

    render() {
        const user = this.state.user;
        const fields: { [P in keyof Partial<User>]: DetailRowSpec } = {
            id: { 
                name: "ID" 
            },
            name: { 
                name: "Name" 
            },
            fullName: { 
                name: "Full Name" 
            },
            identities: {
                name: "E-mail Addresses",
                render: (u: User) => {
                    return u.identities.filter( i => !!i.primaryEmail).map(i => <span><a href={'mailto:' + i.primaryEmail}>{i.primaryEmail}</a> </span>);
                }
            },
            blocked: { 
                name: "Blocked",
                render: (u: User) => {
                    if (u.blocked) {
                        return <strong>blocked</strong>
                    } else {
                        return "not blocked"
                    }
                },
                actions: (u: User) => {
                    if (!!this.state.ourself) {
                        return <div />;
                    }

                    if (u.blocked) {
                        return <Button color="secondary" disabled={!!this.state.blockingOp} onClick={() => this.blockUser(false)}>Unblock</Button>
                    } else {
                        return <Button color="secondary" disabled={!!this.state.blockingOp} onClick={() => this.blockUser(true)}>Block</Button>
                    }
                }
            },
            creationDate: { 
                name: "Signup Date" 
            },
            allowsMarketingCommunication: { 
                name: "Allows Marketing Communication",
                render: (u: User) => !!u.allowsMarketingCommunication ? "yes" : "no"
            },
            rolesOrPermissions: { 
                name: "Roles and Permissions",
                render: (u: User) => <React.Fragment>{(u.rolesOrPermissions || []).map((r, i) => {
                    let tpe = "role";
                    if (r in Permissions) {
                        tpe = "permission";
                    }
                    return <Chip key={i} label={`${tpe}: ${r}`} onDelete={() => this.state.addingRoleOp === 'none' ? this.modifyRoleOrPermission(r, false) : undefined} style={{marginRight: '0.5em'}} />;
                })}</React.Fragment>,
                actions: (u: User) => <Button color="secondary" disabled={this.state.addingRoleOp !== 'none'} onClick={() => this.state.addingRoleOp === 'none' ? this.setState({addingRoleOp: 'choose'}) : undefined}>Add</Button>
            },
            featureFlags: {
                name: "Feature Flags",
                render: (u: User) => <React.Fragment>{u.featureFlags && [
                    (u.featureFlags.permanentWSFeatureFlags || []).map((ff, idx) => <Chip key={idx} label={`workspace: ${ff}`} onDelete={() => this.state.addingFeatureFlagOp === 'none' ? this.modifyWorkspaceFeatureFlags(ff, false) : undefined} style={{marginRight: '0.5em'}} />),
                ]}
                </React.Fragment>,
                actions: (u: User) => <Button color="secondary" disabled={this.state.addingFeatureFlagOp !== 'none'} onClick={() => this.state.addingFeatureFlagOp === 'none' ? this.setState({addingFeatureFlagOp: 'choose'}) : undefined}>Add</Button>
            }
        };

        return <React.Fragment>
            <SelectRoleOrPermissionDialog
                open={this.state.addingRoleOp === 'choose'}
                onSelect={r => this.modifyRoleOrPermission(r, true)}
            />
            <SelectWorkspaceFeatureFlagDialog
                open={this.state.addingFeatureFlagOp === 'choose'}
                onSelect={r => this.modifyWorkspaceFeatureFlags(r, true)}
            />
            { user && 
                <Grid container>
                    <Grid item xs={1}>
                        <Avatar
                            alt={user.name}
                            src={user.avatarUrl}
                            style={{
                                borderRadius: 3,
                                marginLeft: 20
                            }}
                            data-testid={"avatar-" + user.id}>
                            </Avatar>
                    </Grid>
                    <Grid item xs={11}>
                        <Typography variant="h1">{user.name}</Typography>
                    </Grid>
                    {/* { !this.state.ourself && <Grid item xs={2} style={{textAlign: "right"}}><Button color="secondary" variant="contained">Delete</Button></Grid>} */}
                </Grid>
            }
            { !user && <div className="loading-skeleton dummy" style={{ minWidth: "20em", minHeight: "10em" }} /> }
            { user &&
                <Table>
                    {
                        Object.getOwnPropertyNames(fields).map((f, i) => <TableRow key={i}>
                            <TableCell><strong>{fields[f].name}</strong></TableCell>
                            <TableCell>{!!fields[f].render ? fields[f].render(user) : user[f]}</TableCell>
                            <TableCell style={{textAlign: "right"}}>{fields[f].actions && fields[f].actions(user)}</TableCell>
                        </TableRow>)
                    }
                    {
                        this.props.renderAdditionalUserProperties && this.props.renderAdditionalUserProperties(this.props.service, user)
                    }
                </Table>
            }

            <Typography variant="h3" style={{paddingTop: '2em'}}>Workspaces</Typography>
            { this.state.user && <WorkspacesView service={this.props.service} ownerID={this.state.user.id} /> }
        </React.Fragment>
    }

    protected async blockUser(blocked: boolean) {
        this.setState({ blockingOp: true });
        try {
            const user = await this.props.service.server.adminBlockUser({ id: this.props.userID, blocked });
            this.setState({ user, blockingOp: false });
        } catch (err) {
            console.error(err);
            alert(err);
        } finally {
            this.setState({ blockingOp: false });
        }
    }

    protected async modifyRoleOrPermission(r: RoleOrPermission | undefined, add: boolean) {
        if (!r) {
            this.setState({ addingRoleOp: 'none' });
            return;
        }

        this.setState({ addingRoleOp: 'working' });
        try {
            const user = await this.props.service.server.adminModifyRoleOrPermission({
                id: this.props.userID,
                rpp: [{ add, r }]
            });
            this.setState({ user });
        } catch (err) {
            console.error("Error modifing role or permission: " + err);
            alert(err);
        } finally {
            this.setState({ addingRoleOp: 'none' });
        }
    }

    protected async modifyWorkspaceFeatureFlags(featureFlag: NamedWorkspaceFeatureFlag | undefined, add: boolean) {
        if (!featureFlag) {
            this.setState({ addingFeatureFlagOp: 'none' });
            return;
        }

        this.setState({ addingFeatureFlagOp: 'working' });
        try {
            const user = await this.props.service.server.adminModifyPermanentWorkspaceFeatureFlag({
                id: this.props.userID, changes: [{ add, featureFlag }]
            });
            this.setState({ user });
        } catch (err) {
            console.error("Error modifing user's feature flags: " + err);
            alert(err);
        } finally {
            this.setState({ addingFeatureFlagOp: 'none' });
        }
    }

}
/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as React from 'react';
import { RoleOrPermission, Roles, Permissions } from "@gitpod/gitpod-protocol";
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import Avatar from '@material-ui/core/Avatar';
import ListItemText from '@material-ui/core/ListItemText';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import Collapse from '@material-ui/core/Collapse';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';

export interface SelectRoleOrPermissionDialogProps {
    open: boolean;
    onSelect: (r?: RoleOrPermission) => void;
}

interface SelectRoleOrPermissionDialogState {
    showRoles: boolean
    showPermissions: boolean
}

export class SelectRoleOrPermissionDialog extends React.Component<SelectRoleOrPermissionDialogProps, SelectRoleOrPermissionDialogState> {

    constructor(p: SelectRoleOrPermissionDialogProps) {
        super(p);
        this.state = {
            showRoles: true,
            showPermissions: false
        };
    }

    render() {
        return <Dialog open={this.props.open}>
            <DialogTitle>Add Roles and Permissions</DialogTitle>
            <DialogContent style={{width: '600px', height: '50vh', overflow: 'y-scroll'}}>
                <List>
                    <ListItem button onClick={() => this.setState({ showRoles: !this.state.showRoles })}>
                        <ListItemAvatar><Avatar>R</Avatar></ListItemAvatar>
                        <ListItemText primary="Roles" />
                        {this.state.showRoles ? <ExpandLess /> : <ExpandMore />}
                    </ListItem>
                    <Collapse in={this.state.showRoles} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            { Object.getOwnPropertyNames(Roles).map(role => 
                                <ListItem button key={role} style={{paddingLeft: '2em'}} onClick={() => this.props.onSelect(role as RoleOrPermission)}>
                                    <ListItemAvatar><Avatar>R</Avatar></ListItemAvatar>
                                    <ListItemText>{role}</ListItemText>
                                </ListItem>
                            ) }
                        </List>
                    </Collapse>
                    <ListItem button onClick={() => this.setState({ showPermissions: !this.state.showPermissions })}>
                        <ListItemAvatar><Avatar>P</Avatar></ListItemAvatar>
                        <ListItemText primary="Permissions" />
                        {this.state.showPermissions ? <ExpandLess /> : <ExpandMore />}
                    </ListItem>
                    <Collapse in={this.state.showPermissions} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            { Object.getOwnPropertyNames(Permissions).map(perm => 
                                <ListItem button key={perm} style={{paddingLeft: '2em'}} onClick={() => this.props.onSelect(perm as RoleOrPermission)}>
                                    <ListItemAvatar><Avatar>P</Avatar></ListItemAvatar>
                                    <ListItemText>{perm}</ListItemText>
                                </ListItem>
                            ) }
                        </List>
                    </Collapse>
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.props.onSelect(undefined)} color="secondary">Cancel</Button>
            </DialogActions>
        </Dialog>
    }

}

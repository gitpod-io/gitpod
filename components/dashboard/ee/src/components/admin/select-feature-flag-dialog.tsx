/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as React from 'react';
import { WorkspaceFeatureFlags, NamedWorkspaceFeatureFlag } from "@gitpod/gitpod-protocol";
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

export interface SelectWorkspaceFeatureFlagDialogProps {
    open: boolean;
    onSelect: (r?: NamedWorkspaceFeatureFlag) => void;
}

interface SelectWorkspaceFeatureFlagDialogState {
}

export class SelectWorkspaceFeatureFlagDialog extends React.Component<SelectWorkspaceFeatureFlagDialogProps, SelectWorkspaceFeatureFlagDialogState> {

    constructor(p: SelectWorkspaceFeatureFlagDialogProps) {
        super(p);
        this.state = {};
    }

    render() {
        return <Dialog open={this.props.open}>
            <DialogTitle>Add Roles and Permissions</DialogTitle>
            <DialogContent style={{width: '600px', height: '50vh', overflow: 'y-scroll'}}>
                <List>
                    {Object.getOwnPropertyNames(WorkspaceFeatureFlags).map((ff, idx) => 
                        <ListItem button key={idx} onClick={() => this.props.onSelect(ff as NamedWorkspaceFeatureFlag)}>
                            <ListItemAvatar><Avatar>P</Avatar></ListItemAvatar>
                            <ListItemText>{ff}</ListItemText>
                        </ListItem>
                    )}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => this.props.onSelect(undefined)} color="secondary">Cancel</Button>
            </DialogActions>
        </Dialog>
    }

}

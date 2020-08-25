/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogActions from '@material-ui/core/DialogActions';
import Button from '@material-ui/core/Button';
import { Typography } from '@material-ui/core';

export interface ShareLinkDialogProps {
    open: boolean;
    title: string;
    message: string;
    link: string;
    onClose?: ()=>void;
}

export interface ShareLinkDialogState {
    copied: boolean;
}

export class ShareLinkDialog extends React.Component<ShareLinkDialogProps, ShareLinkDialogState> {

    protected linkElement = React.createRef<HTMLSpanElement>();

    protected copyLink() {
        const range = document.createRange();
        const element = this.linkElement.current;
        if (element) {
            range.selectNode(element);

            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
            document.execCommand('copy');
            this.setState({
                copied: true
            });
            setTimeout(() => {
                this.setState({
                    copied: false
                });
                if (selection) {
                    selection.removeAllRanges();
                }
            }, 2000);
        }
    }

    public render(): JSX.Element {
        const link = <Typography variant="caption">
            <span ref={this.linkElement} onClick={() => this.copyLink()}>{this.props.link}</span>
        </Typography>;

        return (
            <Dialog open={this.props.open} aria-labelledby="alert-dialog-title" aria-describedby="alert-dialog-description" >
                <DialogTitle id="alert-dialog-title">{this.props.title}{this.state && this.state.copied ? ' - Copied to Clipboard ✔️' : ''}</DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">{this.props.message}</DialogContentText>
                </DialogContent>
                <DialogContent>
                    <DialogContentText style={{whiteSpace: 'nowrap', width: '100%', padding: 10, backgroundColor: 'var(--background-color1)', color: 'var(--font-color1)'}}>
                        {link}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button color="primary" variant="outlined" onClick={this.props.onClose}>Close</Button>
                    <Button color="secondary" variant="outlined" onClick={() => {this.copyLink()}}>Copy to Clipboard</Button>
                </DialogActions>
            </Dialog>
        );
    }
}
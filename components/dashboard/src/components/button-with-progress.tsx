/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Button, { ButtonProps } from '@material-ui/core/Button';
import * as React from 'react';

interface ButtonWithProgressState {
	isBusy: boolean;
}

export class ButtonWithProgress extends React.Component<ButtonProps, ButtonWithProgressState> {

    constructor(props: ButtonProps) {
        super(props);
        this.state = {
            isBusy: false
        };
    }

    protected async handleClick(event: React.MouseEvent<HTMLElement>) {
        this.setState({ isBusy: true });
        const onClick = this.props.onClick;
        if (onClick) {
            try {
                await onClick(event);
            } catch (error) {
                console.error(error);
            }
        }
        this.setState({ isBusy: false });
    }

    render () {
        const disabled = this.state.isBusy;
        return (
            <Button {...this.props}
                onClick={disabled ? undefined : (event: React.MouseEvent<HTMLElement>) => this.handleClick(event)}
                disabled={disabled || this.props.disabled}
            >
                {this.props.children}
            </Button>
        );
    }
}
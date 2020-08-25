/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import Paper from "@material-ui/core/Paper";
import Popper from "@material-ui/core/Popper";
import MenuItem from "@material-ui/core/MenuItem";
import MenuList from "@material-ui/core/MenuList";
import Button, { ButtonProps } from '@material-ui/core/Button';
import * as React from 'react';

interface ButtonWithMenuState {
    open: boolean;
}

interface ButtonWithMenuProps extends ButtonProps {
    readonly onSelectItem: (item: string) => void;
    readonly items: string[];
}

export class ButtonWithMenu extends React.Component<ButtonWithMenuProps, ButtonWithMenuState> {
    protected buttonRef: HTMLElement;

    async componentWillMount() {
        this.setState({ open: false });
    }

    handleToggle = () => {
        this.setState(state => ({ open: !state.open }));
    };

    handleClick = (item?: string) => {
        this.setState({ open: false });
        if (item && this.props.onSelectItem) {
            this.props.onSelectItem(item);
        }
    };

    render() {
        const { open } = this.state;

        return (
            <div>
                <Button
                    {...this.props}
                    buttonRef={node => (this.buttonRef = node)}
                    aria-owns={open ? "menu-list" : undefined}
                    aria-haspopup="true"
                    onClick={this.handleToggle}
                >
                    {this.props.children}
                </Button>
                <Popper open={open} anchorEl={this.buttonRef} disablePortal>
                    <Paper id="menu-list">
                        <ClickAwayListener onClickAway={() => this.handleClick()}>
                            <MenuList>
                                {this.props.items.map(item => (
                                    <MenuItem
                                        onClick={() => this.handleClick(item)}
                                        data-testid={item}
                                    >
                                        {item}
                                    </MenuItem>
                                ))}
                            </MenuList>
                        </ClickAwayListener>
                    </Paper>
                </Popper>
            </div>
        );
    }
}
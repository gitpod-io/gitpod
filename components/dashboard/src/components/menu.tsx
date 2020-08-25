/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, AuthProviderInfo, Branding } from '@gitpod/gitpod-protocol';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import AppBar from '@material-ui/core/AppBar';
import Avatar from "@material-ui/core/Avatar";
import Button from '@material-ui/core/Button';
import Toolbar from '@material-ui/core/Toolbar';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Fade from '@material-ui/core/Fade';
import IconButton from '@material-ui/core/IconButton';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import * as React from 'react';
import { ButtonWithMenu } from './button-with-menu';
import { getSvgPath } from '../withRoot';

export interface MainMenuProps {
    menuEntries: MenuEntry[];

    user?: User;
    authProviders: AuthProviderInfo[];
    userLoaded: boolean;
    branding?: Branding;

    linksOverride?: JSX.Element;
}

interface MainMenuState {
    anchorElement: HTMLElement | undefined;
}

export interface MenuEntry {
    caption: string,
    open: (loc: Location) => string,
}

export namespace MenuEntry {
    export const ACCESS_CONTROL: MenuEntry = {
        caption: 'Access Control',
        open: (loc) => new GitpodHostUrl(loc.toString()).asAccessControl().toString()
    };
    export const SETTINGS: MenuEntry = {
        caption: 'Settings',
        open: (loc) => new GitpodHostUrl(loc.toString()).asSettings().toString()
    };
    export const LOG_OUT: MenuEntry = {
        caption: 'Log Out',
        open: (loc) => new GitpodHostUrl(loc.toString()).withApi({ pathname: '/logout' }).toString()
    };
    export const ALL: MenuEntry[] = [ACCESS_CONTROL, SETTINGS, LOG_OUT];
}

function getLogoPath(branding?: Branding): string {
    if (!branding) {
        return '';
    }
    return getSvgPath(branding.logo);
}

export class MainMenu extends React.Component<MainMenuProps, MainMenuState> {

    private handleClick(event: React.MouseEvent<HTMLElement>) {
        this.setState({ anchorElement: event.currentTarget });
    }

    private handleClose(entry?: MenuEntry) {
        this.setState({ anchorElement: undefined });

        if (!entry) {
            return
        }
        window.location.href = entry.open(window.location);
    }

    render() {
        const anchorElement = this.state ? this.state.anchorElement : undefined;
        let userSection = undefined;

        if (this.props.userLoaded) {
            if (this.props.user) {
                const menuItems = this.props.menuEntries.map(e => <MenuItem key={e.caption} onClick={event => this.handleClose(e)}>{e.caption}</MenuItem>);

                const abbr = (name: string) => name.split(/(\W)/g).filter(x => x.length > 1).map(x => x[0].toUpperCase()).join("");
                const avatarText = this.props.user.avatarUrl ? null : abbr(this.props.user.name || "?");

                userSection = (
                    <div>
                        <IconButton
                            id="avatar-menu-button"
                            aria-label="Account menu"
                            aria-owns={'account-menu'}
                            aria-haspopup="true"
                            style={{ padding: '0px' }}
                            onClick={event => this.handleClick(event)}
                        >
                            <Avatar
                                alt={this.props.user.name}
                                src={this.props.user.avatarUrl}
                                style={{
                                    borderRadius: 3
                                }}
                                data-testid={"avatar-" + this.props.user.id}>
                                {avatarText}
                            </Avatar>
                            <ExpandMoreIcon />
                        </IconButton>
                        <Menu id="account-menu" 
                                anchorEl={anchorElement} 
                                getContentAnchorEl={null}
                                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                transformOrigin={{ vertical: "top", horizontal: "right" }}
                                open={!!anchorElement} onClose={event => this.handleClose()}>
                            <MenuItem key="placeholder" style={{ display: "none" }} />
                            {menuItems}
                        </Menu>
                    </div>
                );
            } else {
                const items = this.props.authProviders.filter(a => !a.disallowLogin).map(a => a.host);
                if (items.length === 1) {
                    const host = items[0];
                    userSection = (
                        <Button
                            className='button'
                            variant='outlined'
                            color='secondary'
                            data-testid="login"
                            onClick={() => this.handleLoginWith(host)}
                        >
                            Login
                        </Button>
                    );
                }
                if (items.length > 1) {
                    userSection = (
                        <ButtonWithMenu
                            className='button'
                            variant='outlined'
                            color='secondary'
                            data-testid="login"
                            items={items}
                            onSelectItem={this.handleLoginWith}
                        >
                            Login
                        </ButtonWithMenu>
                    );
                }
            }

            userSection = (
                <Fade in={true}>
                    {userSection || <div></div>}
                </Fade>
            );
        }

        return (
            <AppBar position='static'>
                <Toolbar className="content toolbar">
                    <div className="gitpod-logo">
                        <a href={this.props.branding ? this.props.branding.homepage : 'javascript:void(0)'}>
                            <img src={getLogoPath(this.props.branding)} aria-hidden="true" className="logo" />
                        </a>
                    </div>
                    <div className="gitpod-links">
                        <div className="link-container">
                        { this.props.linksOverride }
                        { !this.props.linksOverride && 
                            (this.props.branding ? this.props.branding.links.header : []).map(({name, url}: Branding.Link) => this.createAnchor(name, url))
                        }
                        </div>
                    </div>
                    <div className="user-section">{userSection}</div>
                </Toolbar>
            </AppBar>
        );
    }
    protected createAnchor(name: string, url: string) {
        if (url.startsWith('/')) {
            return <a href={url} key={"a-" + name}>{name}</a>;
        } else {
            return <a href={url} key={"a-" + name} target="_blank" rel="noopener">{name}</a>;
        }
    }

    protected handleLoginWith = (host: string) => {
        const provider = this.props.authProviders.find(a => a.host === host);
        if (provider) {
            this.doLogin(provider.host);
        }
    }

    protected doLogin(host: string) {
        window.location.href = new GitpodHostUrl(window.location.href).withApi({
            pathname: '/login/',
            search: `host=${host}`
        }).toString();
    }
}
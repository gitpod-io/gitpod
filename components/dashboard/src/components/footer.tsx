/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Branding } from '@gitpod/gitpod-protocol';
import { getSvgPath } from '../withRoot';

export interface FooterProps {
    branding?: Branding;
}

export class Footer extends React.Component<FooterProps, {}> {
    render() {
        const branding = this.props.branding && this.props.branding;
        return (<footer className="gitpod-footer">
            <div className="container">
                <div className="row gitpod-links" style={{ marginTop: 5 }}>
                    {(branding ? branding.links.footer : []).map(({ name, url }: Branding.Link) => this.createAnchor(name, url))}
                </div>
                {branding && !!branding.links.social.length &&
                    (<div className="row" style={{ fontSize: 10 }}>
                        <div>Stay connected</div>
                        {branding.links.social.map(({ type, url }: Branding.SocialLink) => {
                            return (<div key={type}>
                                <a title={type} href={url} target="_blank" rel="noopener noreferrer">
                                    <img alt={type} className="logo-icon" src={getSvgPath(`/images/social/${type}.svg`)} />
                                </a>
                            </div>);
                        })}
                    </div>)
                }
                <div className="row" style={{ height: 30, fontSize: 10, marginBottom: 15 }}>
                    <p>Copyright © 2020&nbsp;<a href="https://www.typefox.io/" target="_blank" rel="noopener">TypeFox</a>&nbsp;|&nbsp;All Rights Reserved
                    {(branding ? branding.links.legal : []).map(({ name, url }: Branding.Link) => {
                    return (<span key={name}>&nbsp;|&nbsp;{this.createAnchor(name, url)}</span>);
                    })}
                    </p>
                </div>
            </div>
        </footer>);
    }
    protected createAnchor(name: string, url: string) {
        if (url.startsWith('/')) {
            return <a href={url} key={"a-" + name}>{name}</a>;
        } else {
            return <a href={url} key={"a-" + name} target="_blank" rel="noopener">{name}</a>;
        }
    }
}
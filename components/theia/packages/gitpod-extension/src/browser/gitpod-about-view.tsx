/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { Branding } from '@gitpod/gitpod-protocol';

export class GitpodAboutView extends React.Component<{ branding?: Branding, host: string }> {

    render(): JSX.Element {
        return <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            {this.createLogo(this.props.branding)}
            {this.createFooter(this.props.branding)}
        </div>;
    }

    protected createLogo(branding?: Branding) {
        const logo = branding && branding.logo;
        if (logo) {
            // Handle host-absolute paths
            let logoUri = logo;
            if (logoUri.startsWith("/")) {
                logoUri = this.props.host + logoUri;
            }
            return (<div><img src={logoUri} style={{ width: '250px', paddingBottom: '20px' }}></img></div>);
        } else {
            return (
                <div>
                    <span className="gitpod-logo" style={{
                        width: '96px',
                        height: '96px',
                        marginLeft: '6px'
                    }} />
                    <h1>Gitpod</h1>
                </div>
            );
        }
    }

    protected createFooter(branding?: Branding) {
        const year = new Date().getFullYear().toString();
        const customized = branding && !!branding.ide;
        if (customized) {
            return (<span>
                Copyright {year} GitPod. All Rights Reserved
            </span>);
        } else {
            return (<span>
                Copyright {year} Gitpod. All Rights Reserved | <a className="theia-href" target="_blank" href="https://www.gitpod.io/terms/">Terms of Service</a>
            </span>);
        }
    }

}
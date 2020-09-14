/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import "reflect-metadata";
import { createGitpodService } from "./service-factory";
import { renderEntrypoint } from "./entrypoint";

import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

import { ApplicationFrame } from "./components/page-frame";
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { AuthProviders } from './components/auth-providers';
import { GitpodService } from '@gitpod/gitpod-protocol';

const service = createGitpodService();
const userPromise = service.server.getLoggedInUser({});

// redirect asap, if already logged in
userPromise.then(() => {
    window.location.href = new GitpodHostUrl(window.location.toString()).asDashboard().toString();
}).catch(console.info);

export class FirstStepsIndex extends React.Component {
    render() {
        return (
            <ApplicationFrame>
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: 30 }}>
                    <div>
                        <Typography variant="h4">Just one more thing</Typography>
                        <Typography variant="h6" style={{ marginTop: '20px' }}>
                            To complete the setup of this Gitpod installation, you need to setup a Git Provider.
                        </Typography>
                    </div>
                </div>
                <Paper style={{ padding: '20px', marginTop: '20px' }}>
                    <FirstSteps service={service} />
                </Paper>
            </ApplicationFrame>
        );
    }
}

interface FirstStepsProps {
    service: GitpodService;
}
interface FirstStepsState {
}
class FirstSteps extends React.Component<FirstStepsProps, FirstStepsState> {
    constructor(props: FirstStepsProps) {
        super(props);
        this.state = {
        };
    }

    render() {
        return (
            <React.Fragment>
                <AuthProviders service={this.props.service} mode="initial-setup"/>
            </React.Fragment>
        );
    }

}

renderEntrypoint(FirstStepsIndex);

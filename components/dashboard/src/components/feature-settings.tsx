/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as protocol from '@gitpod/gitpod-protocol';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import Checkbox from '@material-ui/core/Checkbox';
import * as React from 'react';
import debounce = require('lodash.debounce');
import { IDESettings } from './ide-settings';

export class FeatureSettingsProps {
    service: protocol.GitpodService;
    user: protocol.User;
}

export class FeatureSettingsState {
    experimentalFeatures: boolean
    additionalData: protocol.AdditionalUserData
}

export class FeatureSettings extends React.Component<FeatureSettingsProps, FeatureSettingsState> {

    constructor(props: FeatureSettingsProps) {
        super(props);
    }

    private setStateFromUser(user: protocol.User) {
        this.setState(prevState => {
            const additionalData = user.additionalData || {};
            return { ...prevState, 
                additionalData,
                experimentalFeatures: additionalData.experimentalFeatures || false,
            };
        });
    }

    componentWillMount() {
        this.setStateFromUser((this.props.user));
    }

    componentDidUpdate(prevProps: FeatureSettingsProps) {
        if (this.props.user !== prevProps.user) {
            this.setStateFromUser((this.props.user));
        }
    }

    render() {
        return <Grid xs={12}>
            <div><small>Enabling experimental features gives you access to Gitpod's latest functionality and features. Some of those you'll notice immediately, others operate behind the scenes. <i>Here be dragons.</i></small></div>
            <FormControlLabel control={<Checkbox checked={this.state.experimentalFeatures} onChange={() => this.updateFeatureFlags(!this.state.experimentalFeatures)} />} label={"Enable experimental features"} />
            { this.state.experimentalFeatures && <div>
                <h4>Default IDE</h4>
                <div><small>By default Gitpod uses Eclipse Theia as IDE. However, other IDEs may become available in the future. Choose below to try a different IDE.</small></div>
                <IDESettings service={this.props.service} user={this.props.user} />
            </div> }
        </Grid>
    }

    protected updateFeatureFlags = debounce(async (enable: boolean) => {
        try {
            const additionalData = (this.state.additionalData || {});
            additionalData.experimentalFeatures = enable;
            const user = await this.props.service.server.updateLoggedInUser({ additionalData });
            this.setStateFromUser(user);
        } catch (e) {
            console.error('Failed to update IDE settings:', e);
        }
    }, 150);
    
}
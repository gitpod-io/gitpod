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
    featurePreview: boolean
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
                featurePreview: additionalData.featurePreview || false,
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
            <div><small>This option enables a Beta preview of some of the latest functionalities and features that are being actively developed. Some of them are user-facing features while others
                take place in the backstage, see <a href="https://www.gitpod.io/docs/feature-preview/" target="_blank">relevant documentation</a>. If you have suggestions on how we can improve a
                feature, please provide feedback by <a href="https://github.com/gitpod-io/gitpod/issues/new/choose" target="_blank">opening an issue</a>.
            </small></div>
            <FormControlLabel control={<Checkbox checked={this.state.featurePreview} onChange={() => this.updateFeatureFlags(!this.state.featurePreview)} />} label={"Enable Feature Preview"} />
            { this.state.featurePreview && <div>
                <h4>Default IDE</h4>
                <div><small>By default Gitpod uses Eclipse Theia as IDE. However, other IDEs may become available in the future. Choose below to try a different IDE.</small></div>
                <IDESettings service={this.props.service} user={this.props.user} />
            </div> }
        </Grid>
    }

    protected updateFeatureFlags = debounce(async (enable: boolean) => {
        try {
            const additionalData = (this.state.additionalData || {});
            additionalData.featurePreview = enable;
            const user = await this.props.service.server.updateLoggedInUser({ additionalData });
            this.setStateFromUser(user);
        } catch (e) {
            console.error('Failed to update IDE settings:', e);
        }
    }, 150);
    
}
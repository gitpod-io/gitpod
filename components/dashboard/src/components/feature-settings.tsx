/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as protocol from '@gitpod/gitpod-protocol';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import * as React from 'react';
import { IDESettings } from './ide-settings';

export class FeatureSettingsProps {
    service: protocol.GitpodService;
    user: protocol.User;
    onChange: (update: Partial<protocol.User>) => void
}

export class FeatureSettings extends React.Component<FeatureSettingsProps> {

    render() {
        const { featurePreview } = this;
        return <Grid xs={12}>
            <FormControlLabel
                control={<Checkbox color="default" checked={featurePreview} onChange={this.updateFeatureFlags} />}
                label={
                    <>
                        Enable Feature Preview
                    <Typography variant="caption">
                            This will enable a beta preview of some of the latest functionalities and features that are being actively developed.&nbsp;
                    <a href="https://www.gitpod.io/docs/feature-preview/" target="_blank">Learn more</a>
                        </Typography>
                    </>
                } />
            {featurePreview && <div>
                <h4>Default IDE</h4>
                <div><small>By default Gitpod uses Eclipse Theia as IDE. However, other IDEs may become available in the future. Choose below to try a different IDE.</small></div>
                <IDESettings service={this.props.service} user={this.props.user} onChange={this.props.onChange} />
            </div>}
        </Grid>
    }

    private get featurePreview(): boolean {
        return this.props.user.additionalData?.featurePreview || false;
    }

    private updateFeatureFlags = () => {
        const additionalData = (this.props.user.additionalData || {});
        additionalData.featurePreview = !this.featurePreview;
        if (additionalData.featurePreview) {
            const settings = additionalData.ideSettings || {};
            if (!('defaultIde' in settings)) {
                settings.defaultIde = 'code';
            }
            additionalData.ideSettings = settings;
        }
        this.props.onChange({ additionalData });
    };

}
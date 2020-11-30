/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodService, User } from "@gitpod/gitpod-protocol";
import Checkbox from '@material-ui/core/Checkbox';
import Grid from '@material-ui/core/Grid';
import * as React from 'react';

export class UserSettingsProps {
    service: GitpodService;
    user?: User;
    onChange: (update: Partial<User>) => void
}

export class UserSettings extends React.Component<UserSettingsProps> {

    render() {
        if (!this.props.user) {
            return <div></div>;
        }
        const { allowsMarketingCommunication, disallowTransactionalEmails } = this;
        return <Grid container spacing={8} justify="flex-end">
            <Grid item xs={12}>
                <Checkbox
                    onChange={this.updateTransactionalMailSettings}
                    checked={!disallowTransactionalEmails}
                    color="default"
                />
                Receive important emails about changes to my account
            </Grid>
            <Grid item xs={12}>
                <Checkbox
                    onChange={this.updateAllowsMarketingCommunication}
                    checked={allowsMarketingCommunication}
                    color="default"
                />
                Receive marketing emails (for example, the Gitpod newsletter)
            </Grid>
        </Grid>;
    }

    private get allowsMarketingCommunication(): boolean {
        return this.props.user?.allowsMarketingCommunication === true;
    }

    private get disallowTransactionalEmails(): boolean {
        return this.props.user?.additionalData?.emailNotificationSettings?.disallowTransactionalEmails === true;
    }

    private updateTransactionalMailSettings = () => {
        const additionalData = (this.props.user?.additionalData || {});
        const settings = additionalData.emailNotificationSettings || {};
        settings.disallowTransactionalEmails = !this.disallowTransactionalEmails;
        additionalData.emailNotificationSettings = settings;
        this.props.onChange({ additionalData });
    }

    private updateAllowsMarketingCommunication = () => {
        this.props.onChange({
            allowsMarketingCommunication: !this.allowsMarketingCommunication
        });
    }

}
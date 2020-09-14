/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { User, GitpodService, AdditionalUserData } from "@gitpod/gitpod-protocol";
import Checkbox from '@material-ui/core/Checkbox';
import Grid from '@material-ui/core/Grid';

export class UserSettingsProps {
    service: GitpodService;
    user?: User;
}

export class UserSettingsState {
    additionalData?: AdditionalUserData;
    allowsMarketingCommunication?: boolean;
}

export class UserSettings extends React.Component<UserSettingsProps, UserSettingsState> {

    constructor(props: UserSettingsProps) {
        super(props);
        this.state = {};
    }

    componentWillMount() {
        this.update(this.props.user);
    }
    componentDidUpdate(prevProps: UserSettingsProps) {
        if (this.props.user !== prevProps.user) {
            this.update(this.props.user);
        }
    }

    protected update(user: User | undefined) {
        if (!user) {
            return;
        }
        const additionalData = user.additionalData || {};
        additionalData.emailNotificationSettings = additionalData.emailNotificationSettings || {};
        const { allowsMarketingCommunication } = user;
        this.setState({
            additionalData,
            allowsMarketingCommunication
        });
    }


    private async updateTransactionalMailSettings(allowsTransactionalMail: boolean): Promise<void> {
        if (!this.state.additionalData) {
            return undefined;
        }
        const settings = this.state.additionalData.emailNotificationSettings!;
        settings.disallowTransactionalEmails = !allowsTransactionalMail;
        const additionalData = { ...this.state.additionalData };
        additionalData.emailNotificationSettings!.disallowTransactionalEmails = !allowsTransactionalMail;
        const user = await this.props.service.server.updateLoggedInUser({ user: { additionalData } });
        this.update(user);
    }

    private async updateAllowsMarketingCommunication(allowsMarketingCommunication: boolean): Promise<void> {
        const user = await this.props.service.server.updateLoggedInUser({ user: { allowsMarketingCommunication } });
        this.update(user);
    }

    render() {
        if (!this.state.additionalData) {
            return <div></div>;
        }
        const allowsMarketingCommunication = this.state.allowsMarketingCommunication === true;
        const allowsTransactionalMail = !this.state.additionalData.emailNotificationSettings!.disallowTransactionalEmails;
        return <Grid container spacing={8} justify="flex-end">
            <Grid item xs={12}>
                <Checkbox
                    onChange={() => this.updateTransactionalMailSettings(!allowsTransactionalMail)}
                    checked={allowsTransactionalMail}
                />
                Receive important emails about changes to my account
            </Grid>
            <Grid item xs={12}>
                <Checkbox
                    onChange={() => this.updateAllowsMarketingCommunication(!allowsMarketingCommunication)}
                    checked={allowsMarketingCommunication}
                />
                Receive marketing emails (for example, the Gitpod newsletter)
            </Grid>
        </Grid>;
    }

}
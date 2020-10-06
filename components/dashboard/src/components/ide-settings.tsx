/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as protocol from '@gitpod/gitpod-protocol';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import Input from '@material-ui/core/Input';
import Radio from '@material-ui/core/Radio';
import * as React from 'react';
import debounce = require('lodash.debounce');

export class IDESettingsProps {
    service: protocol.GitpodService;
    user: protocol.User;
}

const IDEAliases = {
    'theia': undefined,
    'code': undefined
}
type IDEAlias = keyof typeof IDEAliases;
function isIDEAlias(ide: string | undefined): ide is IDEAlias {
    return !!ide && ide in IDEAliases;
}
type IDEKind = IDEAlias | 'image';

export class IDESettingsState {
    value: IDEKind;
    image?: string;
    additionalData?: protocol.AdditionalUserData;
}

export class IDESettings extends React.Component<IDESettingsProps, IDESettingsState> {

    constructor(props: IDESettingsProps) {
        super(props);
        this.state = {
            value: 'theia'
        };
    }

    componentWillMount() {
        this.setStateFromUser(this.props.user);
    }
    componentDidUpdate(prevProps: IDESettingsProps) {
        if (this.props.user !== prevProps.user) {
            this.setStateFromUser(this.props.user);
        }
    }

    private setStateFromUser(user: protocol.User) {
        this.setState(prevState => {
            const additionalData = user.additionalData;
            const defaultIde = additionalData?.ideSettings?.defaultIde;
            if (isIDEAlias(defaultIde)) {
                return { value: defaultIde, additionalData }
            }
            if (defaultIde) {
                return { value: 'image', image: defaultIde, additionalData };
            }
            return { ...prevState, additionalData };
        });
    }

    render() {
        return <React.Fragment>
            {this.renderRadio('Theia', 'theia')}
            {this.renderRadio('Code', 'code')}
            {this.renderRadio('IDE Image:', 'image')}
        </React.Fragment>
    }

    private renderRadio(label: string, value: IDEKind) {
        const checked = value === this.state.value;
        return <Grid item xs={12}>
            <FormControlLabel control={<Radio />} label={label} value={value} checked={checked} onChange={this.updateDefaultIde} />
            {value === 'image' && <Input value={this.state.image} onChange={this.updateDefaultIde} />}
        </Grid>;
    }

    private updateDefaultIde = async (event: React.ChangeEvent<HTMLInputElement>) => {
        let value = this.state.value;
        let image = this.state.image;
        if (event.target.type === 'radio') {
            value = event.target.value as IDEKind;
            this.setState({ value });
        } else {
            image = event.target.value;
            this.setState({ image });
        }

        this.updateIDESettings({ value, image });
    }

    protected updateIDESettings = debounce(async ({ value, image }: IDESettingsState) => {
        try {
            ;
            const settings = this.state.additionalData?.ideSettings || {};
            if (value === 'theia') {
                delete settings.defaultIde;
            } else if (value === 'image') {
                settings.defaultIde = image;
            } else {
                settings.defaultIde = value;
            }
            const additionalData = (this.state.additionalData || {});
            additionalData.ideSettings = settings;
            const user = await this.props.service.server.updateLoggedInUser({ additionalData });
            this.setStateFromUser(user);
        } catch (e) {
            console.error('Failed to update IDE settings:', e);
        }
    }, 150);

}
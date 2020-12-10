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

export class IDESettingsProps {
    service: protocol.GitpodService;
    user: protocol.User;
    onChange: (update: Partial<protocol.User>) => void
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

export interface IDESettingsState {
    value?: IDEKind
    image?: string
}

export class IDESettings extends React.Component<IDESettingsProps, IDESettingsState> {

    constructor(props: IDESettingsProps) {
        super(props);
        this.state = this.updateStateFromProps({})
    }

    componentDidUpdate(prevProps: IDESettingsProps): void {
        if (this.props.user === prevProps.user) {
            return;
        }
        this.setState(state => this.updateStateFromProps(state));
    }

    private updateStateFromProps(current: IDESettingsState): IDESettingsState {
        const defaultIde = this.props.user.additionalData?.ideSettings?.defaultIde;
        if (isIDEAlias(defaultIde)) {
            return { ...current, value: defaultIde };
        }
        if (defaultIde === undefined) {
            return { ...current, value: 'theia' };
        }
        return { ...current, value: 'image', image: defaultIde };
    }

    render() {
        return <React.Fragment>
            {this.renderRadio('Theia', 'theia')}
            {this.renderRadio('Code', 'code')}
            {this.props.user.rolesOrPermissions?.includes("ide-settings") && this.renderRadio('Image', 'image')}
        </React.Fragment>
    }

    private renderRadio(label: string, value: IDEKind) {
        const checked = value === this.state.value;
        return <Grid container>
            <Grid item xs={1}>
                <FormControlLabel control={<Radio color="default" />} label={label} value={value} checked={checked} onChange={this.updateState} />
            </Grid>
            <Grid item xs={11}>
                {value === 'image' && this.renderImage()}
            </Grid>
        </Grid>
    }

    private renderImage() {
        return <Input
            value={this.state.image}
            onChange={this.updateState}
            placeholder="Type a reference to docker image, e.g. index.docker.io/gitpod-io/theia-ide:latest"
            error={this.state.value === 'image' && (this.state.image === undefined || this.state.image.trim() === "")}
            fullWidth={true}
        />;
    }

    private updateState = (event: React.ChangeEvent<HTMLInputElement>) => {
        const state: IDESettingsState = {}
        if (event.target.type === 'radio') {
            state.value = event.target.value as IDEKind;
        } else {
            state.image = event.target.value;
        }
        this.setState(state, () => this.fireStateChange());
    }

    private fireStateChange(): void {
        const { value, image } = this.state;

        const additionalData = (this.props.user.additionalData || {});
        const settings = additionalData.ideSettings || {};
        if (value === 'theia') {
            delete settings.defaultIde;
        } else if (value === 'image') {
            settings.defaultIde = image || '';
        } else {
            settings.defaultIde = value;
        }
        if (settings.defaultIde?.trim() === "") {
            // invalid
            return;
        }
        additionalData.ideSettings = settings;
        this.props.onChange({ additionalData });
    }

}
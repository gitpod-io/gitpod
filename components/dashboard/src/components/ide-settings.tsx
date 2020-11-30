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

export class IDESettings extends React.Component<IDESettingsProps> {

    render() {
        return <React.Fragment>
            {this.renderRadio('Theia', 'theia')}
            {this.renderRadio('Code', 'code')}
            {this.props.user.rolesOrPermissions?.includes("ide-settings") && this.renderRadio('Image', 'image')}
        </React.Fragment>
    }

    private renderRadio(label: string, value: IDEKind) {
        const checked = value === this.value;
        return <Grid item xs={12}>
            <FormControlLabel control={<Radio color="default" />} label={label} value={value} checked={checked} onChange={this.updateDefaultIde} />
            {value === 'image' && <Input value={this.image} onChange={this.updateDefaultIde} />}
        </Grid>;
    }

    private get value(): IDEKind {
        const defaultIde = this.props.user.additionalData?.ideSettings?.defaultIde;
        if (isIDEAlias(defaultIde)) {
            return defaultIde;
        }
        if (defaultIde) {
            return 'image';
        }
        return 'theia';
    }

    private get image(): string | undefined {
        const defaultIde = this.props.user.additionalData?.ideSettings?.defaultIde;
        if (isIDEAlias(defaultIde)) {
            return undefined;
        }
        return defaultIde;
    }

    private updateDefaultIde = (event: React.ChangeEvent<HTMLInputElement>) => {
        let value = this.value;
        let image = this.image;
        if (event.target.type === 'radio') {
            value = event.target.value as IDEKind;
        } else {
            image = event.target.value;
        }

        const additionalData = (this.props.user.additionalData || {});
        const settings = additionalData.ideSettings || {};
        if (value === 'theia') {
            delete settings.defaultIde;
        } else if (value === 'image') {
            settings.defaultIde = image;
        } else {
            settings.defaultIde = value;
        }
        additionalData.ideSettings = settings;
        this.props.onChange({ additionalData });
    }

}
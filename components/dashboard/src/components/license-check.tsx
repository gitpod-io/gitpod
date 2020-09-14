/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import Snackbar from '@material-ui/core/Snackbar';
import SnackbarContent from '@material-ui/core/SnackbarContent';
import { LicenseValidationResult, LicenseService } from '@gitpod/gitpod-protocol/lib/license-protocol';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';

export interface LicenseCheckProps {
    service: LicenseService;
}
export interface LicenseCheckState {
    result?: LicenseValidationResult;
}

export class LicenseCheck extends React.Component<LicenseCheckProps, LicenseCheckState> {

    constructor(props: LicenseCheckProps) {
        super(props);
        this.state = {};
    }

    public async componentWillMount() {
        this.setState({ result: await this.props.service.validateLicense({}) });
    }

    public render() {
        const result = this.state.result;
        if (!result) {
            return null;
        }

        let message: React.ReactNode | undefined;
        let classname = 'valid';
        if (!result.valid) {
            const licenseLink = new GitpodHostUrl(window.location.toString()).with({ pathname: "license" }).toString();

            message = (<React.Fragment>
                <p><strong>Your Gitpod license is invalid.</strong></p>
                <p>Please <a href={licenseLink} target="_blank">purchase a license</a>.</p>
            </React.Fragment>);

            classname = 'invalid';
        } else if (result.issue === "seats-exhausted") {
            message = "Maximum number of users reached.";
            classname = 'overstretched';
        }

        if (!!message) {
            return (
                <Snackbar open={true} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                    <SnackbarContent message={message} className={'license-' + classname} />
                </Snackbar>
            );
        } else {
            return null;
        }
    }

}

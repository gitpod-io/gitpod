/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import * as React from 'react';
import { AccessControl } from "./components/access-control/access-control";
import { ApplicationFrame } from './components/page-frame';
import { renderEntrypoint } from './entrypoint';
import { createGitpodService } from './service-factory';

export class AccessControlIndex extends React.Component {
    protected service = createGitpodService();

    render() {
        return (
            <ApplicationFrame service={this.service}>
                <AccessControl
                    service={this.service} />
            </ApplicationFrame>
        )
    }
}

renderEntrypoint(AccessControlIndex);

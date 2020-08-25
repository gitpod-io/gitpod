/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import * as React from 'react';

import Workspaces from './components/workspaces';
import { ApplicationFrame } from "./components/page-frame";
import { createGitpodService } from "./service-factory";
import { LicenseCheck } from "./components/license-check";

import { Context } from "./context";
import { renderEntrypoint } from "./entrypoint";

export class ListWorkspacesIndex extends React.Component {
    protected service = createGitpodService();

	render() {
		return (
            <ApplicationFrame service={this.service}>
                <Context.Consumer>
                    {(ctx) => ctx.creditAlert}
                </Context.Consumer>
                <LicenseCheck service={this.service.server} />
                <Context.Consumer>
                    {(ctx) =>
                        <Workspaces
                            service={this.service}
                            disableActions={ctx.disabledActions} />
                    }
                </Context.Consumer>
            </ApplicationFrame>
		);
	}
}

renderEntrypoint(ListWorkspacesIndex);

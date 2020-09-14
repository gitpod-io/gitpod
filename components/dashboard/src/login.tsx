/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import "reflect-metadata";
import { createGitpodService } from "./service-factory";
import { ApplicationFrame } from "./components/page-frame";
import { renderEntrypoint } from "./entrypoint";
import { Login } from './components/login/login';

const service = createGitpodService();
const user = service.server.getLoggedInUser({});
const authProviders = service.server.getAuthProviders({}).then(list => list.filter(p => !p.disallowLogin));

export class LoginIndex extends React.Component {
    render() {
        return (
            <ApplicationFrame service={service} userPromise={user}>
	            <Login {...{ user, authProviders }}/>
            </ApplicationFrame>
        );
    }
}

renderEntrypoint(LoginIndex);
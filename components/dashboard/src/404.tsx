/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';

import { createGitpodService } from './service-factory';
import { ApplicationFrame } from "./components/page-frame";

import ShowGenericError from './components/show-generic-error';
import { renderEntrypoint } from "./entrypoint";

export class NotFound extends React.Component<{}, {}> {

    private service = createGitpodService();

    render() {
        return (
            <ApplicationFrame service={this.service}>
                <ShowGenericError
                    heading={'Sorry, this page can\'t be found 😳'}
                    errorMessage='404'
                    showNewIssueLink={false} />
            </ApplicationFrame>
        );
    }
}

renderEntrypoint(NotFound);

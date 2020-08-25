/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';

export namespace ShowGenericError {
    export interface Props {
        heading?: string;
        errorMessage?: string;
        showNewIssueLink?: boolean;
    }
}

export default class ShowGenericError extends React.Component<ShowGenericError.Props> {

    get heading(): string {
        return this.props.heading || 'Sorry, something went wrong 😓';
    }

    get errorMessage(): string {
        return this.props.errorMessage || 'This should not have happened';
    }

    get showNewIssueLink(): boolean {
        return typeof this.props.showNewIssueLink === 'boolean' ? this.props.showNewIssueLink : true;
    }

    render() {
        return (
            <div className="sorry">
                <h3>{this.heading}</h3>
                <h2>{this.errorMessage}</h2>
                {!this.showNewIssueLink ? undefined : (
                    <p style={{ marginTop: 60 }}>Please <a href="https://github.com/gitpod-io/gitpod/issues/new?template=bug_report.md"
                            target="_blank" rel="noopener noreferrer">file an issue</a> if you think this is a bug.</p>
                )}
            </div>
        );
    }
}

/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { DisposableCollection } from '@theia/core/lib/common/disposable';
import { GitHubModel } from '../github-model';

export class RefreshView extends React.Component<RefreshView.Props> {

    protected readonly toDispose = new DisposableCollection();
    componentDidMount(): void {
        this.toDispose.push(this.props.gitHub.onDidRefreshChanged(() => this.forceUpdate()));
    }

    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    render(): JSX.Element | null {
        return <div className="refresh-view">
            {this.props.children}
            {this.renderRefresh()}
        </div>;
    }

    protected renderRefresh(): JSX.Element {
        if (this.props.gitHub.refreshing) {
            return <div className="refresh-icon"><span className="fa fa-refresh fa-spin" /></div>;
        }
        return <div className="refresh-icon" onClick={this.refresh}><span className="fa fa-refresh" /></div>;
    }

    protected readonly refresh = () => this.props.gitHub.refresh();


}
export namespace RefreshView {
    export interface Props {
        children: any
        gitHub: GitHubModel
    }
}

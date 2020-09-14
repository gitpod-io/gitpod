/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { WhitelistedRepository, GitpodService, DisposableCollection, GitpodServer } from '@gitpod/gitpod-protocol';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { ResponseError } from 'vscode-jsonrpc';
import RepositoryEntry from './repository-entry';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

interface FeaturedRepositoryProps {
	searchText?: string;
	service: GitpodService;
	disableActions: boolean;
}

interface FeaturedRepositoryState {
	repositories?: WhitelistedRepository[];
	searchString?: string;
}

export class FeaturedRepositories extends React.Component<FeaturedRepositoryProps, FeaturedRepositoryState> {

	private disposables = new DisposableCollection();

	componentWillMount() {
		this.updateRepositoryList();
	}

	componentWillUnmount() {
		this.disposables.dispose();
	}

	private async updateRepositoryList(options?: GitpodServer.GetWorkspacesParams) {
		try {
			const repositories = await this.props.service.server.getFeaturedRepositories({});
			this.setState({ repositories });
		} catch (err) {
			log.error(err);
			if (err instanceof ResponseError && err.code === ErrorCodes.NOT_AUTHENTICATED) {
				return;
			}
		}
	}

	render() {
		if (!this.state || !this.state.repositories) {
			return <div></div>;
		}

		let workspacesRows: JSX.Element[] = this.state.repositories
			.map(repo => {
				return (
					<Grid
						item
						key={repo.url}
						xs={12}>
						<RepositoryEntry
							repository={repo}
							disabled={this.props.disableActions}
							/>
					</Grid>
				);
			});
		if (workspacesRows.length === 0) {
			workspacesRows = [(
				<Grid
					item
					xs={12}>
					<Paper style={{ padding: 30 }}>
						<Typography variant="subheading">
							No whitelisted repositories were found.
						</Typography>
					</Paper>
				</Grid>
			)];
		}

		return (
			<Grid container spacing={8} className="workspace-list">
				{workspacesRows}
			</Grid>
		);
	}
}

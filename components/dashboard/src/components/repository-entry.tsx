/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { WhitelistedRepository } from '@gitpod/gitpod-protocol';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import * as markdownit from 'markdown-it';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import IconDetail from './icon-detail';

import 'octicons/build/build.css';

const markGithub: string = require('octicons/build/svg/mark-github.svg');

interface RepositoryEntryProps {
    repository: WhitelistedRepository;
    disabled: boolean;
}

export default class RepositoryEntry extends React.Component<RepositoryEntryProps, {}> {

    render(): React.ReactNode {
        const description = new markdownit({ html: false }).render(this.props.repository.description || "");
        return (
            <Paper className={'workspace-details Stopped'} style={{ marginBottom: 15 }}>
                <div className='stage'>
                    <div style={{ padding: '10px' }} />
                    <Grid
                        container
                        className='main'>
                        <Grid item
                            xs={7}
                            className='title'>
                            <Typography variant="headline" component="h3" style={{ flexGrow: 1 }}>
                                {this.props.repository.name}
                            </Typography>
                        </Grid>
                        <Grid item xs={5} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <IconDetail
                                text={this.props.repository.url.replace(/^[a-zA-Z]{3,5}\:\/{2}[a-zA-Z0-9_.:-]+\//, '')}
                                iconSrc={markGithub}
                                link={this.props.repository.url}
                            />
                        </Grid>

                        <Grid item xs={8} style={{ paddingTop: '0.5em' }}>
                            <Typography dangerouslySetInnerHTML={{ __html: description }} />
                        </Grid>

                        <Grid item xs={12} style={{ textAlign: 'right'}}>
                            <Button
                                key='start'
                                className='button'
                                variant='outlined'
                                color='secondary'
                                target='_blank'
                                href={new GitpodHostUrl(window.location.toString()).withContext(this.props.repository.url).toString()}
                                disabled={this.props.disabled}>Create Workspace</Button>
                        </Grid>
                    </Grid>
                </div>
            </Paper>
        );
    }
}

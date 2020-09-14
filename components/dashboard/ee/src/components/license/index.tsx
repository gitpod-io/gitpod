/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as React from 'react';
import "reflect-metadata";
import moment = require('moment');

import { ApplicationFrame } from '../../../../src/components/page-frame';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { ResponseError } from 'vscode-jsonrpc';

import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

import { User, GitpodService, LicenseInfo } from '@gitpod/gitpod-protocol';

export interface LicenseProps {
    service: GitpodService;
    user: Promise<User>;
}

interface LicenseState {
    user?: User;
    newKey?: string;
    isAdmin?: boolean;
    licenseInfo?: LicenseInfo;
}

export class License extends React.Component<LicenseProps, LicenseState> {

    constructor(props: LicenseProps) {
        super(props);

        this.state = {};
        (async () => {
            try {
                await this.updateLicense();
                // the state is to be considered complete once the user is set
                const user = await this.props.user;
                this.setState({
                    user
                });
            } catch (e) {
                if (e instanceof ResponseError && e.code === ErrorCodes.NOT_AUTHENTICATED) {
                    window.location.href = new GitpodHostUrl(window.location.toString()).withApi({
                        pathname: '/login/',
                        search: 'returnTo=' + encodeURIComponent(window.location.toString())
                    }).toString();
                }
                throw e;
            }
        })();
    }
    protected async updateLicense() {
        const { isAdmin, licenseInfo } = await this.props.service.server.getLicenseInfo({});
        this.setState({
            isAdmin,
            licenseInfo
        });
    }

    render() {
        const { user } = this.state;
        return (<ApplicationFrame service={this.props.service} userPromise={this.props.user}>
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: 30 }}>
                <div>
                    <Typography variant="h4">License</Typography>
                    <Typography variant="h6" style={{ marginTop: '20px' }}>{this.renderHeader()}</Typography>
                </div>
            </div>
            <Paper style={{ padding: '20px', marginTop: '20px' }}>
                {!!user && (this.renderLicenseForm(user))}
            </Paper>
        </ApplicationFrame>);
    }

    protected renderLicenseForm(user: User): JSX.Element {
        const { licenseInfo, isAdmin } = this.state;
        const hasLicenseKey = licenseInfo && !!licenseInfo.key;
        const valid = licenseInfo && licenseInfo.valid;
        const validityDate = licenseInfo && moment(new Date(licenseInfo.validUntil)).format('YYYY-MM-DD') || "";
        return (<React.Fragment>
            <Grid container style={{ display: "flex" }}>
                {!hasLicenseKey && !isAdmin && (
                    <Grid item xs={12} >
                        {this.renderTextCell("No license entered.")}
                    </Grid>
                )}

                {hasLicenseKey && valid && (
                    <React.Fragment>
                        <Grid item xs={2} >
                            {this.renderTextCell("Number of seats")}
                        </Grid>
                        <Grid item xs={10} >
                            {this.renderTextCell(String(licenseInfo && licenseInfo.seats || 0))}
                        </Grid>
                        <Grid item xs={2} >
                            {this.renderTextCell("Valid until")}
                        </Grid>
                        <Grid item xs={10}>
                            {this.renderTextCell(validityDate)}
                        </Grid>
                        <Grid item xs={2} >
                            {this.renderTextCell("Plan")}
                        </Grid>
                        <Grid item xs={10}>
                            {this.renderTextCell(licenseInfo && licenseInfo.plan || "")}
                        </Grid>
                    </React.Fragment>
                )}

                {isAdmin && this.renderLicenseKeyRow()}
            </Grid>
        </React.Fragment>);
    }

    protected renderHeader() {
        const { user } = this.state;
        const domain = window.location.hostname;
        const userEmail = user && user.identities.map(i => i.primaryEmail).filter(email => !!email)[0];
        const enterpricseLicenseUrl = `https://www.gitpod.io/enterprise-license?domain=${domain}&userEmail=${userEmail}`;

        return (<p>You can obtain a license key from <a href={enterpricseLicenseUrl} target="_blank">gitpod.io/enterprise-license</a></p>);
    }

    protected renderTextCell = (text: string) => (<Typography style={{ margin: "10px", display: "inline-block" }}>
        {text}
    </Typography>);

    protected renderLicenseKeyRow() {
        const { newKey, licenseInfo } = this.state;
        const valid = licenseInfo && licenseInfo.valid;
        const disableButton = !newKey;
        return (<React.Fragment>
            <Grid item xs={2} >
                {this.renderTextCell("Key")}
            </Grid>
            <Grid item xs={10}>
                <TextField
                    value={newKey || licenseInfo && licenseInfo.key || ""}
                    placeholder={"Paste a license key here"}
                    onChange={this.licenseKeyChanged}
                    label={valid ? "" : "INVALID"}
                    error={!valid}
                    margin="dense"
                    multiline={true}
                    rows={8}
                    style={{ width: "100%", margin: "10px" }}
                />
            </Grid>
            <Grid item xs={12} style={{ textAlign: "right", marginTop: "12px" }}>
                <Button onClick={this.doUpdateLicenseKey} variant='outlined' color='secondary' disabled={disableButton}>Update</Button>
            </Grid>
        </React.Fragment>);
    }

    protected readonly licenseKeyChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ newKey: e.target.value });
    };

    protected readonly doUpdateLicenseKey = async () => {
        const { newKey } = this.state;
        if (!newKey) {
            return;
        }
        await this.props.service.server.adminSetLicense({key: newKey});
        this.setState({ newKey: undefined });
        await this.updateLicense();
    };

}
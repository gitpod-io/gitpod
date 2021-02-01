/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';
import * as Cookies from 'js-cookie';

import { createGitpodService } from './service-factory';
import { ApplicationFrame } from "./components/page-frame";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";

import Avatar from "@material-ui/core/Avatar";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { ButtonWithProgress } from "./components/button-with-progress";

import { renderEntrypoint } from "./entrypoint";

const service = createGitpodService();
const accountHints = (() => {
    try {
        const cookie = Cookies.getJSON('SelectAccountCookie');
        if (SelectAccountPayload.is(cookie)) {
            return cookie;
        }
    } catch (error) {
        console.log(error);
    }
    return undefined;
})();

export class ProceedWithAccount extends React.Component<{}, {}> {

    render() {
        if (!accountHints) {
            // this is only expected to happen if someone goes back in browser history.
            // in such cases we've nothing to show here, thus redirecting to /access-control
            window.location.href = new GitpodHostUrl(window.location.href).asAccessControl().toString();

            return (
                <ApplicationFrame service={service}>
                    <h3>Cookie 🍪 not found</h3>
                    <h2>Redirecting to Access Control...</h2>
                </ApplicationFrame>
            );
        }
        const { currentUser, otherUser } = accountHints;

        const accessControlUrl = new GitpodHostUrl(window.location.href).asAccessControl().toString();

        const loginUrl = new GitpodHostUrl(window.location.href).withApi({
            pathname: '/login/',
            search: `host=${otherUser.authHost}&returnTo=${encodeURIComponent(accessControlUrl)}`
        }).toString();

        const logoutUrl = new GitpodHostUrl(window.location.toString()).withApi({
            pathname: "/logout",
            search: `returnTo=${encodeURIComponent(loginUrl)}`
        }).toString();

        const onGoBackClicked = () => {
            window.location.href = accessControlUrl;
        };
        const onSwitchAccountsClicked = () => {
            window.location.href = logoutUrl;
        };

        return (
            <ApplicationFrame service={service}>
                <div className='content content-area'>

                    <h3 style={{ textAlign: "center" }}>Select An Account</h3>

                    <Typography component="p" style={{ textAlign: "center", fontSize: "110%", marginTop: "50px" }}>
                        You are attempting to authorize a provider that is already connected with your other account on Gitpod.
                        <br />
                        Please switch to the other account or disconnect the provider from your current account in Access Control.
                    </Typography>

                    <div style={{ display: "flex", marginTop: "50px", width: "100%" }}>
                        <div style={{ flex: "50%" }}>
                            <div style={{
                                width: "300px",
                                margin: "0 20px 0 auto"
                            }}>
                                <Typography component="p" style={{ textAlign: "center", padding: "20px", fontSize: "110%" }}>
                                    Current account
                                </Typography>
                                <Card>
                                    <CardContent
                                        style={{
                                            textAlign: "center"
                                        }}
                                    >
                                        <div>
                                            <Avatar
                                                style={{
                                                    margin: "40px auto 40px",
                                                    width: 110,
                                                    height: 110
                                                }}
                                                alt={currentUser.name} src={currentUser.avatarUrl}
                                            />
                                            <Typography component="p" style={{ textAlign: "center", padding: "20px", fontSize: "110%" }}>
                                                Connected as <strong>@{currentUser.authName}</strong>
                                                <br />
                                                from <strong>{currentUser.authHost}</strong>
                                            </Typography>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                        <div style={{ flex: "50%" }}>
                            <div style={{
                                width: "300px",
                                margin: "0 auto 0 20px"
                            }}>
                                <Typography component="p" style={{ textAlign: "center", padding: "20px", fontSize: "110%" }}>
                                    Other account
                                </Typography>
                                <Card>
                                    <CardContent
                                        style={{
                                            textAlign: "center"
                                        }}
                                    >
                                        <div>
                                            <Avatar
                                                style={{
                                                    margin: "40px auto 40px",
                                                    width: 110,
                                                    height: 110
                                                }}
                                                alt={otherUser.name} src={otherUser.avatarUrl}
                                            />
                                            <Typography component="p" style={{ textAlign: "center", padding: "20px", fontSize: "110%" }}>
                                                Connected as <strong>@{otherUser.authName}</strong>
                                                <br />
                                                from <strong>{otherUser.authHost}</strong>
                                            </Typography>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: "100px", textAlign: "center" }}>
                        <ButtonWithProgress
                            className='button'
                            onClick={onGoBackClicked}
                            variant='outlined'
                            color={'primary'}>
                            {'Back To Access Control'}
                        </ButtonWithProgress>

                        <ButtonWithProgress
                            style={{ marginLeft: "20px" }}
                            className='button'
                            onClick={onSwitchAccountsClicked}
                            variant='outlined'
                            color={'secondary'}>
                            {'Switch To Your Other Account'}
                        </ButtonWithProgress>
                    </div>

                </div>
            </ApplicationFrame>
        );
    }

}

renderEntrypoint(ProceedWithAccount);

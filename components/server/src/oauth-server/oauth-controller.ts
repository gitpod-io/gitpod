/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthCodeRepositoryDB } from '@gitpod/gitpod-db/lib/typeorm/auth-code-repository-db';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { User } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { OAuthException, OAuthRequest, OAuthResponse } from "@jmondi/oauth2-server";
import * as express from 'express';
import { inject, injectable } from "inversify";
import { URL } from 'url';
import { Config } from '../config';
import { clientRepository, createAuthorizationServer } from './oauth-authorization-server';

@injectable()
export class OAuthController {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(AuthCodeRepositoryDB) protected readonly authCodeRepositoryDb: AuthCodeRepositoryDB;

    private getValidUser(req: express.Request, res: express.Response): User | null {
        if (!req.isAuthenticated() || !User.is(req.user)) {
            const redirectTarget = encodeURIComponent(`${this.config.hostUrl}api${req.originalUrl}`);
            const redirectTo = `${this.config.hostUrl}login?returnTo=${redirectTarget}`;
            res.redirect(redirectTo)
            return null;
        }
        const user = req.user as User;
        if (!user) {
            res.sendStatus(500);
            return null;
        }
        if (user.blocked) {
            res.sendStatus(403);
            return null;
        }
        return user;
    }

    private async hasApproval(user: User, clientID: string, req: express.Request, res: express.Response): Promise<boolean> {
        // Have they just authorized, or not, the local-app?
        const wasApproved = req.query['approved'] || '';
        if (wasApproved === 'no') {
            const additionalData = user?.additionalData;
            if (additionalData && additionalData.oauthClientsApproved) {
                delete additionalData.oauthClientsApproved[clientID];
                await this.userDb.updateUserPartial(user);
            }

            // Let the local app know they rejected the approval
            const rt: string = req.query.redirect_uri;
            const redirectURLObject = new URL(rt);

            if (!rt || !rt.startsWith("http://127.0.0.1:") || !(['vscode:', 'vscode-insiders:'].includes(redirectURLObject.protocol) && redirectURLObject.pathname !== '//gitpod.gitpod-desktop/complete-gitpod-auth')) {
                log.error(`/oauth/authorize: invalid returnTo URL: "${rt}"`)
                res.sendStatus(400);
                return false;
            }
            res.redirect(`${rt}/?approved=no`);
            return false;
        } else if (wasApproved == 'yes') {
            const additionalData = user.additionalData = user.additionalData || {};
            additionalData.oauthClientsApproved = {
                ...additionalData.oauthClientsApproved,
                [clientID]: new Date().toISOString()
            }
            await this.userDb.updateUserPartial(user);
        } else {
            const oauthClientsApproved = user?.additionalData?.oauthClientsApproved;
            if (!oauthClientsApproved || !oauthClientsApproved[clientID]) {
                const client = await clientRepository.getByIdentifier(clientID)
                if (client) {
                    const redirectTarget = encodeURIComponent(`${this.config.hostUrl}api${req.originalUrl}`);
                    const redirectTo = `${this.config.hostUrl}oauth-approval?clientID=${client.id}&clientName=${client.name}&returnTo=${redirectTarget}`;
                    res.redirect(redirectTo)
                    return false;
                } else {
                    log.error(`/oauth/authorize unknown client id: "${clientID}"`)
                    res.sendStatus(400);
                    return false;
                }
            }
        }
        return true;
    }

    get oauthRouter(): express.Router {
        const router = express.Router();
        if (!this.config.oauthServer.enabled) {
            log.warn('OAuth server disabled!')
            return router;
        }

        const authorizationServer = createAuthorizationServer(this.authCodeRepositoryDb, this.userDb, this.userDb, this.config.oauthServer.jwtSecret);
        router.get("/oauth/authorize", async (req: express.Request, res: express.Response) => {
            const clientID = req.query.client_id;
            if (!clientID) {
                res.sendStatus(400);
                return false;
            }

            const user = this.getValidUser(req, res);
            if (!user) {
                return;
            }

            // Check for approval of this client
            if (!this.hasApproval(user, clientID, req, res)) {
                return;
            }

            const request = new OAuthRequest(req);

            try {
                // Validate the HTTP request and return an AuthorizationRequest object.
                const authRequest = await authorizationServer.validateAuthorizationRequest(request);

                // Once the user has logged in set the user on the AuthorizationRequest
                authRequest.user = { id: user.id }

                // The user has approved the client so update the status
                authRequest.isAuthorizationApproved = true;

                // Return the HTTP redirect response
                const oauthResponse = await authorizationServer.completeAuthorizationRequest(authRequest);
                return handleResponse(req, res, oauthResponse);
            } catch (e) {
                handleError(e, res);
            }
        });

        router.post("/oauth/token", async (req: express.Request, res: express.Response) => {
            const response = new OAuthResponse(res);
            try {
                const oauthResponse = await authorizationServer.respondToAccessTokenRequest(req, response);
                return handleResponse(req, res, oauthResponse);
            } catch (e) {
                handleError(e, res);
                return;
            }
        });

        function handleError(e: Error | undefined, res: express.Response) {
            if (e instanceof OAuthException) {
                res.status(e.status);
                res.send({
                    status: e.status,
                    message: e.message,
                    stack: e.stack,
                });
                return;
            }
            // Generic error
            res.status(500)
            res.send({
                err: e
            })
        }

        function handleResponse(req: express.Request, res: express.Response, response: OAuthResponse) {
            if (response.status === 302) {
                if (!response.headers.location) {
                    throw new Error("missing redirect location");
                }
                res.set(response.headers);
                res.redirect(response.headers.location);
            } else {
                res.set(response.headers);
                res.status(response.status).send(response.body);
            }
        }

        return router;
    }
}
/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthCodeRepositoryDB } from '@gitpod/gitpod-db/lib/typeorm/auth-code-repository-db';
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import { User } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { OAuthRequest, OAuthResponse } from "@jmondi/oauth2-server";
import { handleExpressResponse, handleExpressError } from "@jmondi/oauth2-server/dist/adapters/express"
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
        // Have they just authorized, or not, registered clients?
        const wasApproved = req.query['approved'] || '';
        if (wasApproved === 'no') {
            const additionalData = user?.additionalData;
            if (additionalData && additionalData.oauthClientsApproved) {
                delete additionalData.oauthClientsApproved[clientID];
                await this.userDb.updateUserPartial(user);
            }

            // Let the client know they rejected the approval
            const client = await clientRepository.getByIdentifier(clientID);
            if (client) {
                const normalizedRedirectUri = new URL(req.query.redirect_uri);
                normalizedRedirectUri.search = '';

                if (!client.redirectUris.some(u => new URL(u).toString() === normalizedRedirectUri.toString())) {
                    log.error(`/oauth/authorize: invalid returnTo URL: "${req.query.redirect_uri}"`)
                    res.sendStatus(400);
                    return false;
                }
            } else {
                log.error(`/oauth/authorize unknown client id: "${clientID}"`)
                res.sendStatus(400);
                return false;
            }
            const redirectUri = new URL(req.query.redirect_uri);
            redirectUri.searchParams.append('approved', 'no');
            res.redirect(redirectUri.toString());
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
                return handleExpressResponse(res, oauthResponse);
            } catch (e) {
                handleExpressError(e, res);
            }
        });

        router.post("/oauth/token", async (req: express.Request, res: express.Response) => {
            const response = new OAuthResponse(res);
            try {
                const oauthResponse = await authorizationServer.respondToAccessTokenRequest(req, response);
                return handleExpressResponse(res, oauthResponse);
            } catch (e) {
                handleExpressError(e, res);
                return;
            }
        });

        return router;
    }
}
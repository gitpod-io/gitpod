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
import { Env } from "../env";
import { createAuthorizationServer } from '../oauth2-server/oauth-authorization-server';
import { localAppClientID } from "./db";

@injectable()
export class OAuthController {
    @inject(Env) protected readonly env: Env;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(AuthCodeRepositoryDB) protected readonly authCodeRepositoryDb: AuthCodeRepositoryDB;

    get oauthRouter(): express.Router {
        const authorizationServer = createAuthorizationServer(this.authCodeRepositoryDb, this.userDb);
        const router = express.Router();
        router.get("/oauth/authorize", async (req: express.Request, res: express.Response) => {
            log.info(`AUTHORIZE: ${JSON.stringify(req.query)}`);

            if (!req.isAuthenticated() || !User.is(req.user)) {
                const redirectTarget = encodeURIComponent(`${this.env.hostUrl}api${req.originalUrl}`);
                const redirectTo = `${this.env.hostUrl}login?returnTo=${redirectTarget}`;
                log.info(`AUTH Redirecting to login: ${redirectTo}`);
                res.redirect(redirectTo)
                return
            }

            const user = req.user as User;
            if (user.blocked) {
                res.sendStatus(403);
                return;
            }

            // Have they authorized the local-app?
            const wasApproved = req.query['approved'] || '';
            log.info(`APPROVED?: ${wasApproved}`)
            if (wasApproved === 'no') {
                // Let the local app know they rejected the approval
                const rt = req.query.redirect_uri;
                if (!rt || !rt.startsWith("http://localhost:")) {
                    log.error(`/oauth/authorize: invalid returnTo URL: "${rt}"`)
                    res.sendStatus(400);
                    return;
                }
                res.redirect(`${rt}/?approved=no`);
                return;
            }

            const oauth2ClientsApproved = user?.additionalData?.oauth2ClientsApproved;
            const clientID = localAppClientID;
            if (!oauth2ClientsApproved || !oauth2ClientsApproved[clientID]) {
                const client = await authorizationServer.getClientByIdentifier(clientID)
                if (client) {
                    const redirectTarget = encodeURIComponent(`${this.env.hostUrl}api${req.originalUrl}`);
                    const redirectTo = `${this.env.hostUrl}oauth2-approval?clientID=${client.id}&clientName=${client.name}&returnTo=${redirectTarget}`;
                    log.info(`AUTH Redirecting to approval: ${redirectTo}`);
                    res.redirect(redirectTo)
                    return;
                } else {
                    log.error(`/oauth/authorize unknown client id: "${clientID}"`)
                    res.sendStatus(400);
                    return;
                }
            }

            const request = new OAuthRequest(req);

            try {
                // Validate the HTTP request and return an AuthorizationRequest object.
                const authRequest = await authorizationServer.validateAuthorizationRequest(request);

                // Once the user has logged in set the user on the AuthorizationRequest
                authRequest.user = { id: user.id }
                console.log(`user has logged in - setting the user on the AuthorizationRequest ${JSON.stringify(user)}, ${JSON.stringify(authRequest)}`);

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
            log.info(`TOKEN: ${JSON.stringify(req.body)}`);
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
            // TODO(rl) clean up error handling
            log.info('handleError', e ? e.message + '\n' + e.stack : 'no error');

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
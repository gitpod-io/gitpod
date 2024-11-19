/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthCodeRepositoryDB } from "@gitpod/gitpod-db/lib/typeorm/auth-code-repository-db";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { OAuthRequest, OAuthResponse } from "@jmondi/oauth2-server";
import { handleExpressResponse, handleExpressError } from "@jmondi/oauth2-server/dist/adapters/express";
import express from "express";
import { inject, injectable } from "inversify";
import { URL } from "url";
import { Config } from "../config";
import { clientRepository, createAuthorizationServer } from "./oauth-authorization-server";
import { inMemoryDatabase, toolboxClient } from "./db";
import { getFeatureFlagEnableExperimentalJBTB } from "../util/featureflags";

@injectable()
export class OAuthController {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(AuthCodeRepositoryDB) protected readonly authCodeRepositoryDb: AuthCodeRepositoryDB;

    private getValidUser(req: express.Request, res: express.Response): User | null {
        if (!req.isAuthenticated() || !User.is(req.user)) {
            const returnToPath = encodeURIComponent(`/api${req.originalUrl}`);
            const redirectTo = `${this.config.hostUrl}login?returnToPath=${returnToPath}`;
            res.redirect(redirectTo);
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

    private async hasApproval(
        user: User,
        clientID: string,
        req: express.Request,
        res: express.Response,
    ): Promise<boolean> {
        // Have they just authorized, or not, the local-app?
        const wasApproved = req.query["approved"] || "";
        if (wasApproved === "no") {
            const additionalData = user?.additionalData;
            if (additionalData && additionalData.oauthClientsApproved) {
                delete additionalData.oauthClientsApproved[clientID];
                await this.userDb.updateUserPartial(user);
            }

            // Let the local app know they rejected the approval
            const rt = req.query.redirect_uri?.toString();
            if (!rt || !rt.startsWith("http://127.0.0.1:")) {
                log.error(`/oauth/authorize: invalid returnTo URL: "${rt}"`);
            }

            const client = await clientRepository.getByIdentifier(clientID);
            if (client) {
                if (typeof req.query.redirect_uri !== "string") {
                    log.error(req.query.redirect_uri ? "Missing redirect URI" : "Invalid format of redirect URI");
                    res.sendStatus(400);
                    return false;
                }

                const normalizedRedirectUri = new URL(req.query.redirect_uri);
                normalizedRedirectUri.search = "";

                if (!client.redirectUris.some((u) => new URL(u).toString() === normalizedRedirectUri.toString())) {
                    log.error(`/oauth/authorize: invalid returnTo URL: "${req.query.redirect_uri}"`);
                    res.sendStatus(400);
                    return false;
                }
            } else {
                log.error(`/oauth/authorize unknown client id: "${clientID}"`);
                res.sendStatus(400);
                return false;
            }

            const redirectUri = new URL(req.query.redirect_uri);
            redirectUri.searchParams.append("approved", "no");
            res.redirect(redirectUri.toString());
            return false;
        } else if (wasApproved == "yes") {
            const additionalData = (user.additionalData = user.additionalData || {});
            additionalData.oauthClientsApproved = {
                ...additionalData.oauthClientsApproved,
                [clientID]: new Date().toISOString(),
            };
            await this.userDb.updateUserPartial(user);
        } else {
            const oauthClientsApproved = user?.additionalData?.oauthClientsApproved;
            if (!oauthClientsApproved || !oauthClientsApproved[clientID]) {
                const client = await clientRepository.getByIdentifier(clientID);
                if (client) {
                    const returnToPath = encodeURIComponent(`/api${req.originalUrl}`);
                    const redirectTo = `${this.config.hostUrl}oauth-approval?clientID=${client.id}&clientName=${client.name}&returnToPath=${returnToPath}`;
                    res.redirect(redirectTo);
                    return false;
                } else {
                    log.error(`/oauth/authorize unknown client id: "${clientID}"`);
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
            log.warn("OAuth server disabled!");
            return router;
        }

        const authorizationServer = createAuthorizationServer(
            this.authCodeRepositoryDb,
            this.userDb,
            this.userDb,
            this.config.oauthServer.jwtSecret,
        );
        router.get("/oauth/authorize", async (req: express.Request, res: express.Response) => {
            const clientID = req.query.client_id;
            if (!clientID) {
                res.sendStatus(400);
                return false;
            }

            const user = this.getValidUser(req, res);
            if (!user) {
                res.sendStatus(400);
                return;
            }

            // Check for approval of this client
            if (!(await this.hasApproval(user, clientID.toString(), req, res))) {
                res.sendStatus(400);
                return;
            }

            if (clientID === toolboxClient.id) {
                const enableExperimentalJBTB = await getFeatureFlagEnableExperimentalJBTB(user.id);
                if (!enableExperimentalJBTB) {
                    res.sendStatus(400);
                    return false;
                }
            }

            const request = new OAuthRequest(req);

            try {
                // Validate the HTTP request and return an AuthorizationRequest object.
                const authRequest = await authorizationServer.validateAuthorizationRequest(request);

                // Once the user has logged in set the user on the AuthorizationRequest
                authRequest.user = { id: user.id };

                // The user has approved the client so update the status
                authRequest.isAuthorizationApproved = true;

                // Return the HTTP redirect response
                const oauthResponse = await authorizationServer.completeAuthorizationRequest(authRequest);
                return handleExpressResponse(res, oauthResponse);
            } catch (e) {
                try {
                    handleExpressError(e, res);
                } catch (error) {
                    log.error(`Authorization request handling failed.`, error, { request });
                    res.sendStatus(500);
                }
            }
        });

        router.post("/oauth/token", async (req: express.Request, res: express.Response) => {
            const response = new OAuthResponse(res);
            try {
                const oauthResponse = await authorizationServer.respondToAccessTokenRequest(req, response);
                return handleExpressResponse(res, oauthResponse);
            } catch (e) {
                try {
                    handleExpressError(e, res);
                } catch (error) {
                    log.error(`Access token request handling failed.`, error);
                    res.sendStatus(500);
                }
            }
        });

        router.get("/oauth/inspect", async (req: express.Request, res: express.Response) => {
            const clientId = req.query.client as string;
            if (typeof clientId !== "string" || !Object.keys(inMemoryDatabase.clients).includes(clientId)) {
                return res.sendStatus(400);
            }

            const client = inMemoryDatabase.clients[clientId];
            const scopes = client.scopes.map((s) => s.name);
            return res.send(scopes);
        });

        return router;
    }
}

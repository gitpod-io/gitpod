/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthCodeRepositoryDB } from "@gitpod/gitpod-db/lib/typeorm/auth-code-repository-db";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    AuthorizationServer,
    OAuthClient,
    OAuthClientRepository,
    OAuthRequest,
    OAuthResponse,
} from "@jmondi/oauth2-server";
import { handleExpressResponse, handleExpressError } from "@jmondi/oauth2-server/dist/adapters/express";
import express from "express";
import { inject, injectable } from "inversify";
import { URL } from "url";
import { Config } from "../config";
import { createAuthorizationServer } from "./oauth-authorization-server";
import { inMemoryApiTokenDatabase, inMemoryDatabase } from "./db";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ApiTokenRepository } from "./api-token-repository";
import { runWithReqSubjectIdOr } from "../auth/express";
import { ctxSubjectId, ctxUserId } from "../util/request-context";
import { inMemoryClientRepository, inMemoryScopeRepository } from "./repository";

@injectable()
export class OAuthController {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(UserDB) private readonly userDb: UserDB,
        @inject(AuthCodeRepositoryDB) private readonly authCodeRepositoryDb: AuthCodeRepositoryDB,
        @inject(ApiTokenRepository) private readonly apiTokenRepository: ApiTokenRepository,
    ) {}

    private getValidUser(req: express.Request, res: express.Response): User | undefined {
        const user = req.user as User;
        if (!user) {
            res.sendStatus(500);
            return undefined;
        }
        if (user.blocked) {
            res.sendStatus(403);
            return undefined;
        }
        return user;
    }

    private async hasApproval(
        user: User,
        clientID: string,
        clientRepository: OAuthClientRepository,
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
                    const returnToPath = encodeURIComponent(`api${req.originalUrl}`);
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
        router.use(
            runWithReqSubjectIdOr((req, res, next) => {
                const returnToPath = encodeURIComponent(`api${req.originalUrl}`);
                const redirectTo = `${this.config.hostUrl}login?returnToPath=${returnToPath}`;
                res.redirect(redirectTo);
            }),
            (req, res, next) => {
                if (ctxSubjectId()?.kind !== "user") {
                    res.sendStatus(401);
                    return;
                }
            },
        );

        const legacyScopeRepository = inMemoryScopeRepository(inMemoryDatabase);
        const legacyClientRepository = inMemoryClientRepository(inMemoryDatabase);
        const legacyAuthorizationServer = createAuthorizationServer(
            this.authCodeRepositoryDb,
            legacyClientRepository,
            this.userDb,
            legacyScopeRepository,
            this.userDb,
            this.config.oauthServer.jwtSecret,
        );
        const apiTokenScopeRepository = inMemoryScopeRepository(inMemoryApiTokenDatabase);
        const apiTokenClientRepository = inMemoryClientRepository(inMemoryApiTokenDatabase);
        const apiTokenAuthorizationServer = createAuthorizationServer(
            this.authCodeRepositoryDb,
            apiTokenClientRepository,
            this.userDb,
            apiTokenScopeRepository,
            this.apiTokenRepository,
            this.config.oauthServer.jwtSecret,
        );
        async function getAuthorizationServer(userId: string): Promise<{
            authorizationServer: AuthorizationServer;
            clientRepository: OAuthClientRepository;
            clients: { [key: string]: OAuthClient };
        }> {
            const apitokenv0Enabled = await getExperimentsClientForBackend().getValueAsync("apitokenv0_oauth", false, {
                user: {
                    id: userId,
                },
            });

            if (apitokenv0Enabled) {
                return {
                    authorizationServer: apiTokenAuthorizationServer,
                    clientRepository: apiTokenClientRepository,
                    clients: inMemoryApiTokenDatabase.clients,
                };
            } else {
                return {
                    authorizationServer: legacyAuthorizationServer,
                    clientRepository: legacyClientRepository,
                    clients: inMemoryDatabase.clients,
                };
            }
        }

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

            const { authorizationServer, clientRepository } = await getAuthorizationServer(ctxUserId());

            // Check for approval of this client
            if (!(await this.hasApproval(user, clientID.toString(), clientRepository, req, res))) {
                res.sendStatus(400);
                return;
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
                const { authorizationServer } = await getAuthorizationServer(ctxUserId());
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

            const { clients } = await getAuthorizationServer(ctxUserId());
            const clientScopes = clients[clientId].scopes;
            const scopes = clientScopes.map((s) => s.name);
            return res.send(scopes);
        });

        return router;
    }
}

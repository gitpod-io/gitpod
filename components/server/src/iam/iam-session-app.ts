/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as express from "express";
import { SessionHandler } from "../session-handler";
import { Authenticator } from "../auth/authenticator";
import { UserAuthentication } from "../user/user-authentication";
import { OIDCCreateSessionPayload } from "./iam-oidc-create-session-payload";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Identity, User } from "@gitpod/gitpod-protocol";
import { reportJWTCookieIssued } from "../prometheus-metrics";
import { ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { OrganizationService } from "../orgs/organization-service";
import { UserService } from "../user/user-service";

@injectable()
export class IamSessionApp {
    constructor(
        @inject(SessionHandler) private readonly sessionHandler: SessionHandler,
        @inject(Authenticator) private readonly authenticator: Authenticator,
        @inject(UserAuthentication) private readonly userAuthentication: UserAuthentication,
        @inject(UserService) private readonly userService: UserService,
        @inject(OrganizationService) private readonly orgService: OrganizationService,
        @inject(SessionHandler) private readonly session: SessionHandler,
    ) {}

    public getMiddlewares() {
        return [express.json(), this.sessionHandler.http(), ...this.authenticator.initHandlers];
    }

    public create(): express.Application {
        const app = express();
        this.getMiddlewares().forEach((middleware) => {
            app.use(middleware);
        });

        app.post("/session", async (req: express.Request, res: express.Response) => {
            try {
                const result = await this.doCreateSession(req, res);
                res.status(200).json(result);
            } catch (error) {
                log.error("Error creating session on behalf of IAM", error);
                if (ApplicationError.hasErrorCode(error)) {
                    res.status(error.code).json({ message: error.message });
                    return;
                }

                // we treat all errors as bad request here and forward the error message to the caller
                res.status(400).json({ message: error.message });
            }
        });

        return app;
    }

    private async doCreateSession(req: express.Request, res: express.Response) {
        const payload = OIDCCreateSessionPayload.validate(req.body);

        const existingUser = await this.findExistingOIDCUser(payload);
        if (existingUser) {
            await this.updateOIDCUserOnSignin(existingUser, payload);
        }

        const user = existingUser || (await this.createNewOIDCUser(payload));

        const cookie = await this.session.createJWTSessionCookie(user.id);
        res.cookie(cookie.name, cookie.value, cookie.opts);
        reportJWTCookieIssued();

        return {
            userId: user.id,
        };
    }

    /**
     * Maps from OIDC profile (ID token) to `Identity` which is used for the primary
     * lookup of existing users as well as for creating new accounts.
     */
    private mapOIDCProfileToIdentity(payload: OIDCCreateSessionPayload): Identity {
        const {
            claims: { sub, name, email, aud },
        } = payload;
        return {
            authId: sub,
            authProviderId: aud,
            primaryEmail: email,
            authName: name,
        };
    }

    private async findExistingOIDCUser(payload: OIDCCreateSessionPayload): Promise<User | undefined> {
        // Direct lookup
        let existingUser = await this.userAuthentication.findUserForLogin({
            candidate: this.mapOIDCProfileToIdentity(payload),
        });
        if (!existingUser) {
            // Organizational account lookup by email address
            existingUser = await this.userAuthentication.findOrgOwnedUser({
                organizationId: payload.organizationId,
                email: payload.claims.email,
            });
            if (existingUser) {
                log.info("Found Org-owned user by email.", { email: payload?.claims?.email });
            }
        }

        if (existingUser?.organizationId) {
            const members = await this.orgService.listMembers(existingUser.id, existingUser.organizationId);
            if (!members.some((m) => m.userId === existingUser?.id)) {
                // In case `createNewOIDCUser` failed to create a membership for this user,
                // let's try to fix the situation on the fly.
                // Also, if that step repeatedly fails, it would fail the login process earlier but
                // in a more consistent state.
                await this.orgService.addOrUpdateMember(
                    undefined,
                    existingUser.organizationId,
                    existingUser.id,
                    "member",
                );
            }
        }

        return existingUser;
    }

    /**
     * Updates `User.identities[current IdP]` entry
     */
    private async updateOIDCUserOnSignin(user: User, payload: OIDCCreateSessionPayload) {
        const recent = this.mapOIDCProfileToIdentity(payload);
        const existingIdentity = user.identities.find((identity) => identity.authId === recent.authId);

        // Update entry
        if (existingIdentity) {
            await this.userAuthentication.updateUserIdentity(user, {
                ...existingIdentity,
                primaryEmail: recent.primaryEmail,
                lastSigninTime: new Date().toISOString(),
            });
        }
    }

    private async createNewOIDCUser(payload: OIDCCreateSessionPayload): Promise<User> {
        const { claims, organizationId } = payload;

        // Until we support SKIM (or any other means to sync accounts) we create new users here as a side-effect of the login
        const user = await this.userService.createUser({
            organizationId,
            identity: { ...this.mapOIDCProfileToIdentity(payload), lastSigninTime: new Date().toISOString() },
            userUpdate: (user) => {
                user.name = claims.name;
                user.avatarUrl = claims.picture;
            },
        });

        await this.orgService.addOrUpdateMember(undefined, organizationId, user.id, "member");
        return user;
    }
}

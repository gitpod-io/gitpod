/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo } from "@gitpod/gitpod-protocol";
import * as express from "express";
import { injectable } from "inversify";
import { Strategy as DummyStrategy } from "passport-dummy";
import { AuthProvider } from "../auth/auth-provider";
import { Authenticator } from "../auth/authenticator";
import { UserService } from "../user/user-service";
import { DevData } from "./dev-data";

@injectable()
export class AuthenticatorDevImpl extends Authenticator {
    protected async getAuthProviderForHost(_host: string): Promise<AuthProvider | undefined> {
        return new DummyAuthProvider(this.userService);
    }
}

class DummyAuthProvider implements AuthProvider {
    constructor(protected userService: UserService) {}
    get info(): AuthProviderInfo {
        return {
            authProviderId: "Public-GitHub",
            authProviderType: "GitHub",
            verified: true,
            host: "github.com",
            icon: this.params.icon,
            description: this.params.description,
        };
    }
    readonly host = "github.com";
    readonly authProviderId = "GitHub";
    readonly params = {} as any;
    readonly authCallbackPath = "";
    readonly callback = () => {
        throw new Error("Method not implemented.");
    };
    readonly strategy = new DummyStrategy(async (done) => {
        const testUser = DevData.createTestUser();
        try {
            const user = await this.userService.findUserById(testUser.id, testUser.id);
            done(undefined, user);
        } catch (err) {
            done(err, undefined);
        }
    });
    authenticate(req: express.Request, res: express.Response, next: express.NextFunction): void {
        throw new Error("Method not implemented.");
    }
    authorize(
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        state: string,
        scopes: string[],
    ): void {
        throw new Error("Method not implemented.");
    }
}

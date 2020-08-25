/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { User, Identity, WorkspaceTimeoutDuration } from "@gitpod/gitpod-protocol";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TokenProvider } from "./token-provider";
import { Env } from "../env";
import { AuthProviderParams } from "../auth/auth-provider";

export interface FindUserByIdentityStrResult {
    user: User;
    identity: Identity;
    authHost: string;
}

export interface CheckSignUpParams {
    config: AuthProviderParams;
    identity: Identity;
}

@injectable()
export class UserService {
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(Env) protected readonly env: Env;

    /**
     * Takes strings in the form of <authHost>/<authName> and returns the matching User
     * @param identityStr A string of the form <authHost>/<authName>
     * @returns The User associated with the identified Identity
     */
    async findUserByIdentityStr(identityStr: string): Promise<FindUserByIdentityStrResult | undefined> {
        const parts = identityStr.split('/');
        if (parts.length !== 2) {
            return undefined;
        }
        const [authHost, authName] = parts;
        if (!authHost || !authName) {
            return undefined;
        }
        const authProviderId = this.getAuthProviderIdForHost(authHost);
        if (!authProviderId) {
            return undefined;
        }

        const identities = await this.userDb.findIdentitiesByName({ authProviderId, authName });
        if (identities.length === 0)  {
            return undefined;
        } else if (identities.length > 1) {
            // TODO Choose a better solution here. It blocks this lookup until the old account logs in again and gets their authName updated
            throw new Error(`Multiple identities with name: ${authName}`);
        }

        const identity = identities[0];
        const user = await this.userDb.findUserByIdentity(identity);
        if (!user) {
            return undefined;
        }
        return { user, identity, authHost };
    }

    protected getAuthProviderIdForHost(host: string): string | undefined {
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext || !hostContext.authProvider) {
            return undefined;
        }
        return hostContext.authProvider.authProviderId;
    }

    protected async getUser(user: User | string): Promise<User> {
        if (typeof user === 'string') {
            const realUser = await this.userDb.findUserById(user);
            if (!realUser) {
                throw new Error(`No User found for id ${user}!`);
            }
            return realUser;
        } else {
            return user;
        }
    }

    public async createUserForIdentity(identity: Identity): Promise<User> {
        log.debug('(Auth) Creating new user.', { identity, 'login-flow': true });
        const newUser = await this.userDb.newUser();
        newUser.identities.push(identity);
        this.handleNewUser(newUser);
        return await this.userDb.storeUser(newUser);
    }
    protected handleNewUser(newUser: User) {
        if (this.env.blockNewUsers) {
            // By default we block all new users on staging as we don't expected that many new ones.
            // Any legitimate new user on gitpod-staging can talk to the team to get unblocked.
            // TODO Replace this with a more precise mechanism, maybe based on email domains
            newUser.blocked = true;
        }

        if (this.env.makeNewUsersAdmin) {
            // In devstaging we want all users to become admins to make debugging easier.
            newUser.rolesOrPermissions = ['admin'];
        }
    }

    /**
     * Returns the default workspace timeout for the given user at a given point in time
     * @param user
     * @param date The date for which we want to know the default workspace timeout
     */
    async getDefaultWorkspaceTimeout(user: User, date: Date = new Date()): Promise<WorkspaceTimeoutDuration> {
        return "30m";
    }

    async checkSignUp(params: CheckSignUpParams) {
        // no-op here
    }
}
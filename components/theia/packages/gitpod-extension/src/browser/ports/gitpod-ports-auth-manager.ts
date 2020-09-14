/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as Cookies from 'js-cookie';
import { GitpodServiceProvider } from '../gitpod-service-provider';
import { GitpodInfoService } from "../../common/gitpod-info";
import { worspacePortAuthCookieName } from "@gitpod/gitpod-protocol/lib/util/workspace-port-authentication";

@injectable()
export class GitpodPortsAuthManger {
    static readonly REFRESH_COOKIE_INTERVAL_MILLIS = 20 * 60 * 1000;   // 20mins
    static readonly COOKIE_EXPIRY_OFFSET_MILLIS = 5 * 60 * 1000;   // 5mins

    @inject(GitpodInfoService) protected readonly infoProvider: GitpodInfoService;
    @inject(GitpodServiceProvider) protected readonly serviceProvider: GitpodServiceProvider;

    async start() {
        const info = await this.infoProvider.getInfo();
        const workspaceId = info.workspaceId;
        const cookieName = worspacePortAuthCookieName(info.host, workspaceId);

        const hostUrl = new URL(info.host);
        const hostParts = hostUrl.host.split('.');
        const baseDomain = hostParts.slice(hostParts.length - 2).join('.');
        const cookieAttributes = {
            // For all Gitpod workspaces
            domain: `.${baseDomain}`,
            // We set it from JS: no
            httpOnly: false,
            // Use a secure cookie if possible
            secure: hostUrl.protocol === 'https:',
            // This is the relevant part: Configure so it can be passed from other origins!
            sameSite: undefined,
            // Should cover all resources
            path: "/",
        };

        // We want to refresh the auth token in the cookie regularly, but not too often, and make sure it never expires.
        // Thus:
        //  - the token expires after 30mins
        //  - we refresh the token every 20mins
        //  - the cookie (which carries the token) expires 5mins after the token itself
        const updateCookie = async () => {
            const service = await this.serviceProvider.getService();
            const token = await service.server.getPortAuthenticationToken({workspaceId});

            let expires: Date | undefined = undefined;
            if (token.expiryDate) {
                const tokenExpiryDate = Date.parse(token.expiryDate);
                expires = new Date(tokenExpiryDate + GitpodPortsAuthManger.COOKIE_EXPIRY_OFFSET_MILLIS);
            }

            Cookies.set(cookieName, token.value, {
                ...cookieAttributes,
                expires,
            });
        };

        updateCookie(); // Set immediately
        setInterval(() => updateCookie(), GitpodPortsAuthManger.REFRESH_COOKIE_INTERVAL_MILLIS);
    }
}
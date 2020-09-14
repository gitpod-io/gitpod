/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodService, UserPlatform } from "@gitpod/gitpod-protocol";
import * as Cookies from 'js-cookie';
import { UAParser } from 'ua-parser-js';
import * as uuidv4 from 'uuid/v4';

export namespace browserExtension {

    const cookieName = 'user-platform';

    export async function getUserPlatform(service: GitpodService): Promise<UserPlatform | undefined> {
        const user = await service.server.getLoggedInUser({});
        const uid = Cookies.get(cookieName);
        return user.additionalData && user.additionalData.platforms && user.additionalData.platforms.find(p => p.uid === uid);
    }

    export async function updatePlatformInformation(service: GitpodService): Promise<void> {
        const user = await service.server.getLoggedInUser({});
        const now = new Date().toISOString();
        let uid: string | undefined = Cookies.get(cookieName);
        const parser = new UAParser();
        let platform: UserPlatform | undefined;
        
        const data = user.additionalData;
        if (data && data.platforms) {
            // limit length to max 5 entries, due to https://github.com/TypeFox/gitpod/issues/4214
            if (data.platforms.length > 5) {
                data.platforms.splice(0, data.platforms.length - 5);
            }
            if (uid) {
                platform = data.platforms.find(p => p.uid === uid);
            }
            if (!platform) {
                // maybe cookies were deleted. Let's reuse entries with the same useragent string.
                platform = data.platforms.find(p => p.userAgent === parser.getUA());
                if (platform) {
                    uid = platform.uid;
                }
            }
        }

        // fresh platform
        if (!platform) {
            uid = uuidv4();
            platform = {
                uid,
                userAgent: parser.getUA(),
                browser: parser.getBrowser().name || 'unknown',
                os: parser.getOS().name || 'unknown',
                firstUsed: now,
                lastUsed: now
            };
            if (!user.additionalData) {
                user.additionalData = {};
            }
            if (!user.additionalData.platforms) {
                user.additionalData.platforms = [];
            }
            user.additionalData.platforms.push(platform);
        }
        // update data
        platform.lastUsed = now;

        // is browser extension installed
        const isInstalled = isBrowserExtensionInstalled();
        if (isInstalled !== undefined) {
            if (isInstalled && !platform.browserExtensionInstalledSince) {
                platform.browserExtensionInstalledSince = now;
                platform.browserExtensionUninstalledSince = undefined;
            }
            if (!isInstalled 
                && !platform.browserExtensionUninstalledSince) {
                platform.browserExtensionUninstalledSince = now;
            }
        }

        // update user data
        service.server.updateLoggedInUser({ user: { additionalData: user.additionalData } });
        Cookies.set(cookieName, uid!, { expires: 365 });
    }

    function isBrowserExtensionInstalled(): boolean | undefined {
        // check if we are running top level, as the extension is not able to update nested iframes.
        if (window.parent === window) {
            const ele = document.getElementById('ExtensionCheck_GitpodBrowserExtension');
            if (ele) {
                // the browser extension sets the innerHTML to 'installed'
                return ele.innerHTML === 'installed';
            }
        }
        return undefined;
    }

}
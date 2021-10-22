/**
* Copyright (c) 2020 Gitpod GmbH. All rights reserved.
* Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
import { User } from '@gitpod/gitpod-protocol';
import { Request } from 'express';
import { IAnalyticsWriter } from '@gitpod/gitpod-protocol/lib/analytics';

export async function trackLogin(user: User, request: Request, authHost: string, analytics: IAnalyticsWriter) {
    //make new complete identify call for each login
    fullIdentify(user,request,analytics);

    //track the login
    analytics.track({
        userId: user.id,
        event: "login",
        properties: {
            "loginContext": authHost
        }
    });
}

export async function trackSignup(user: User, request: Request, analytics: IAnalyticsWriter) {
        //make new complete identify call for each signup
        fullIdentify(user,request,analytics);

        //track the signup
        analytics.track({
            userId: user.id,
            event: "signup",
            properties: {
                "auth_provider": user.identities[0].authProviderId,
            }
        });
}

async function fullIdentify(user: User, request: Request, analytics: IAnalyticsWriter) {
    //makes a full identify call for authenticated users
    const coords = request.get("x-glb-client-city-lat-long")?.split(", ");
    analytics.identify({
        anonymousId: request.cookies.ajs_anonymous_id,
        userId:user.id,
        context: {
            "ip": maskIp(request.ips[0]),
            "userAgent": request.get("User-Agent"),
            "location": {
                "city": request.get("x-glb-client-city"),
                "country": request.get("x-glb-client-region"),
                "latitude": coords?.length == 2 ? coords[0] : undefined,
                "longitude": coords?.length == 2 ? coords[1] : undefined
            }
        },
        traits: {
            ...resolveIdentities(user),
            "email": User.getPrimaryEmail(user),
            "full_name": user.fullName,
            "created_at": user.creationDate,
            "unsubscribed_onboarding": !user.additionalData?.emailNotificationSettings?.allowsOnboardingMail,
            "unsubscribed_changelog": !user.additionalData?.emailNotificationSettings?.allowsChangelogMail,
            "unsubscribed_devx": !user.additionalData?.emailNotificationSettings?.allowsDevXMail
        }
    });
}

function maskIp(ip: string) {
    const octets = ip.split('.');
    return octets?.length == 4 ? octets.slice(0,3).concat(["0"]).join(".") : undefined;
}

function resolveIdentities(user: User) {
    let identities: { github_slug?: String, gitlab_slug?: String, bitbucket_slug?: String } = {};
    user.identities.forEach((value) => {
        switch(value.authProviderId) {
            case "Public-GitHub": {
                identities.github_slug = value.authName;
                break;
            }
            case "Public-GitLab": {
                identities.gitlab_slug = value.authName;
                break;
            }
            case "Public-Bitbucket": {
                identities.bitbucket_slug = value.authName;
                break;
            }
        }
    });
    return identities;
}
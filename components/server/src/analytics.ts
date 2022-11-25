/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { User } from "@gitpod/gitpod-protocol";
import { Request } from "express";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import * as crypto from "crypto";

export async function trackLogin(
    user: User,
    request: Request,
    authHost: string,
    analytics: IAnalyticsWriter,
    subscriptionService: SubscriptionService,
) {
    // make new complete identify call for each login
    await fullIdentify(user, request, analytics, subscriptionService);
    const ip = request.ips[0];
    const ua = request.headers["user-agent"];

    // track the login
    analytics.track({
        userId: user.id,
        anonymousId: getAnonymousId(request) || createCookielessId(ip, ua),
        event: "login",
        properties: {
            loginContext: authHost,
        },
    });
}

export async function trackSignup(user: User, request: Request, analytics: IAnalyticsWriter) {
    // make new complete identify call for each signup
    await fullIdentify(user, request, analytics);
    const ip = request.ips[0];
    const ua = request.headers["user-agent"];

    // track the signup
    analytics.track({
        userId: user.id,
        anonymousId: getAnonymousId(request) || createCookielessId(ip, ua),
        event: "signup",
        properties: {
            auth_provider: user.identities[0].authProviderId,
            qualified: !!request.cookies["gitpod-marketing-website-visited"],
            blocked: user.blocked,
        },
    });
}

export function createCookielessId(ip?: string, ua?: string): string | number | undefined {
    if (!ip || !ua) {
        return "unidentified-user"; //use placeholder if we cannot resolve IP and user agent
    }
    const date = new Date();
    const today = `${date.getDate()}/${date.getMonth()}/${date.getFullYear()}`;
    return crypto
        .createHash("sha512")
        .update(ip + ua + today)
        .digest("hex");
}

export function maskIp(ip?: string) {
    if (!ip) {
        return;
    }
    const octets = ip.split(".");
    return octets?.length == 4 ? octets.slice(0, 3).concat(["0"]).join(".") : undefined;
}

async function fullIdentify(
    user: User,
    request: Request,
    analytics: IAnalyticsWriter,
    subscriptionService?: SubscriptionService,
) {
    // makes a full identify call for authenticated users
    const coords = request.get("x-glb-client-city-lat-long")?.split(", ");
    const ip = request.ips[0];
    const ua = request.headers["user-agent"];
    var subscriptionIDs: string[] = [];
    const subscriptions = await subscriptionService?.getNotYetCancelledSubscriptions(user, new Date().toISOString());
    if (subscriptions) {
        subscriptionIDs = subscriptions.filter((sub) => !!sub.planId).map((sub) => sub.planId!);
    }
    analytics.identify({
        anonymousId: getAnonymousId(request) || createCookielessId(ip, ua),
        userId: user.id,
        context: {
            ip: ip ? maskIp(ip) : undefined,
            userAgent: ua,
            location: {
                city: request.get("x-glb-client-city"),
                country: request.get("x-glb-client-region"),
                region: request.get("x-glb-client-region-subdivision"),
                latitude: coords?.length == 2 ? coords[0] : undefined,
                longitude: coords?.length == 2 ? coords[1] : undefined,
            },
        },
        traits: {
            ...resolveIdentities(user),
            email: User.getPrimaryEmail(user) || "",
            full_name: user.fullName,
            created_at: user.creationDate,
            unsubscribed_onboarding: user.additionalData?.emailNotificationSettings?.allowsOnboardingMail === false,
            unsubscribed_changelog: user.additionalData?.emailNotificationSettings?.allowsChangelogMail === false,
            unsubscribed_devx: user.additionalData?.emailNotificationSettings?.allowsDevXMail === false,
            subscriptions: subscriptionIDs,
        },
    });
}

function getAnonymousId(request: Request) {
    if (!(request.cookies["gp-analytical"] === "true")) {
        return;
    }
    return stripCookie(request.cookies.ajs_anonymous_id);
}

function resolveIdentities(user: User) {
    let identities: { github_slug?: String; gitlab_slug?: String; bitbucket_slug?: String } = {};
    user.identities.forEach((value) => {
        switch (value.authProviderId) {
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

function stripCookie(cookie: string) {
    if (cookie && cookie.length >= 2 && cookie.charAt(0) == '"' && cookie.charAt(cookie.length - 1) == '"') {
        return cookie.substring(1, cookie.length - 1);
    } else {
        return cookie;
    }
}

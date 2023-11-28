/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { User } from "@gitpod/gitpod-protocol";
import { Request } from "express";
import { IAnalyticsWriter, IdentifyMessage, PageMessage, TrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import * as crypto from "crypto";
import { clientIp } from "./express-util";
import { ctxTrySubjectId } from "./util/request-context";

export async function trackLogin(user: User, request: Request, authHost: string, analytics: IAnalyticsWriter) {
    // make new complete identify call for each login
    await fullIdentify(user, request, analytics);
    const ip = clientIp(request);
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
    const ip = clientIp(request);
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
    return crypto
        .createHash("sha512")
        .update(ip + ua)
        .digest("hex");
}

export function maskIp(ip?: string) {
    if (!ip) {
        return;
    }
    const octets = ip.split(".");
    return octets?.length === 4 ? octets.slice(0, 3).concat(["0"]).join(".") : undefined;
}

async function fullIdentify(user: User, request: Request, analytics: IAnalyticsWriter) {
    // makes a full identify call for authenticated users
    const coords = request.get("x-glb-client-city-lat-long")?.split(", ");
    const ip = clientIp(request);
    const ua = request.headers["user-agent"];
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
                latitude: coords?.length === 2 ? coords[0] : undefined,
                longitude: coords?.length === 2 ? coords[1] : undefined,
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
        },
    });
}

function getAnonymousId(request: Request) {
    if (!(request.cookies["gp-analytical"] === "true")) {
        return;
    }
    return stripCookie(request.cookies.ajs_anonymous_id as string);
}

function resolveIdentities(user: User) {
    const identities: { github_slug?: string; gitlab_slug?: string; bitbucket_slug?: string } = {};
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
    if (cookie && cookie.length >= 2 && cookie.charAt(0) === '"' && cookie.charAt(cookie.length - 1) === '"') {
        return cookie.substring(1, cookie.length - 1);
    }
    return cookie;
}

export class ContextAwareAnalyticsWriter implements IAnalyticsWriter {
    constructor(readonly writer: IAnalyticsWriter) {}

    identify(msg: IdentifyMessage): void {
        this.writer.identify(msg);
    }

    track(msg: TrackMessage): void {
        this.writer.track(msg);
    }

    page(msg: PageMessage): void {
        const traceIds = this.getAnalyticsIds();
        this.writer.page({
            ...msg,
            userId: msg.userId || traceIds.userId,
            subjectId: msg.subjectId || traceIds.subjectId,
        });
    }

    private getAnalyticsIds(): { userId?: string; subjectId?: string } {
        const subjectId = ctxTrySubjectId();
        if (!subjectId) {
            return {};
        }
        return {
            userId: subjectId.userId(),
            subjectId: subjectId.toString(),
        };
    }
}

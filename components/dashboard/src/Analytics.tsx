/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import Cookies from "js-cookie";
import { v4 } from "uuid";
import { StartWorkspaceError } from "./start/StartPage";
import { RemoteTrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";

export type Event =
    | "invite_url_requested"
    | "organisation_authorised"
    | "dotfile_repo_changed"
    | "feedback_submitted"
    | "workspace_class_changed"
    | "privacy_policy_update_accepted"
    | "browser_extension_promotion_interaction"
    | "coachmark_dismissed"
    | "modal_dismiss"
    | "ide_configuration_changed"
    | "status_rendered"
    | "error_rendered"
    | "video_clicked";
type InternalEvent = Event | "path_changed" | "dashboard_clicked";

export type EventProperties =
    | TrackOrgAuthorised
    | TrackInviteUrlRequested
    | TrackDotfileRepo
    | TrackFeedback
    | TrackPolicyUpdateClick
    | TrackBrowserExtensionPromotionInteraction
    | TrackModalDismiss
    | TrackIDEConfigurationChanged
    | TrackWorkspaceClassChanged
    | TrackStatusRendered
    | TrackErrorRendered
    | TrackVideoClicked;
type InternalEventProperties = EventProperties | TrackDashboardClick | TrackPathChanged;

export interface TrackErrorRendered {
    sessionId: string;
    instanceId?: string;
    workspaceId: string;
    type: string;
    error: any;
}

export interface TrackStatusRendered {
    sessionId: string;
    instanceId?: string;
    workspaceId: string;
    type: string;
    phase?: string;
}

export interface TrackWorkspaceClassChanged {}
export interface TrackIDEConfigurationChanged {
    location: string;
    name?: string;
    version?: string;
}
export interface TrackModalDismiss {
    manner: string;
    title?: string;
    specify?: string;
    path: string;
}

export interface TrackOrgAuthorised {
    installation_id: string;
    setup_action: string | undefined;
}

export interface TrackInviteUrlRequested {
    invite_url: string;
}

export interface TrackDotfileRepo {
    previous?: string;
    current: string;
}

export interface TrackFeedback {
    score: number;
    feedback: string;
    href: string;
    path: string;
    error_object?: StartWorkspaceError;
    error_message?: string;
}

export interface TrackPolicyUpdateClick {
    path: string;
    success: boolean;
}

export interface TrackCoachmarkDismissed {
    name: string;
    success: boolean;
}

export interface TrackBrowserExtensionPromotionInteraction {
    action: "chrome_navigation" | "firefox_navigation" | "manually_dismissed";
}

export interface TrackVideoClicked {
    context: string;
    path: string;
}

interface TrackDashboardClick {
    dnt?: boolean;
    path: string;
    button_type?: string;
    label?: string;
    destination?: string;
}

interface TrackPathChanged {
    prev: string;
    path: string;
}

interface Traits {
    unsubscribed_onboarding?: boolean;
    unsubscribed_changelog?: boolean;
    unsubscribed_devx?: boolean;
}

//call this to track all events outside of button and anchor clicks
export function trackEvent(event: "invite_url_requested", properties: TrackInviteUrlRequested): void;
export function trackEvent(event: "organisation_authorised", properties: TrackOrgAuthorised): void;
export function trackEvent(event: "dotfile_repo_changed", properties: TrackDotfileRepo): void;
export function trackEvent(event: "feedback_submitted", properties: TrackFeedback): void;
export function trackEvent(event: "workspace_class_changed", properties: TrackWorkspaceClassChanged): void;
export function trackEvent(event: "privacy_policy_update_accepted", properties: TrackPolicyUpdateClick): void;
export function trackEvent(event: "coachmark_dismissed", properties: TrackCoachmarkDismissed): void;
export function trackEvent(
    event: "browser_extension_promotion_interaction",
    properties: TrackBrowserExtensionPromotionInteraction,
): void;
export function trackEvent(event: "modal_dismiss", properties: TrackModalDismiss): void;
export function trackEvent(event: "ide_configuration_changed", properties: TrackIDEConfigurationChanged): void;
export function trackEvent(event: "status_rendered", properties: TrackStatusRendered): void;
export function trackEvent(event: "error_rendered", properties: TrackErrorRendered): void;
export function trackEvent(event: "video_clicked", properties: TrackVideoClicked): void;
export function trackEvent(event: Event, properties: EventProperties): void {
    trackEventInternal(event, properties);
}

const trackEventInternal = (event: InternalEvent, properties: InternalEventProperties) => {
    sendTrackEvent({
        anonymousId: getAnonymousId(),
        event,
        properties,
    });
};

// Please use trackEvent instead of this function
export function sendTrackEvent(message: RemoteTrackMessage): void {
    sendAnalytics("trackEvent", message);
}

export function trackVideoClick(context: string) {
    trackEvent("video_clicked", {
        context: context,
        path: window.location.pathname,
    });
}

export const trackButtonOrAnchor = (target: HTMLAnchorElement | HTMLButtonElement | HTMLDivElement) => {
    //read manually passed analytics props from 'data-analytics' attribute of event target
    let passedProps: TrackDashboardClick | undefined;
    if (target.dataset.analytics) {
        try {
            passedProps = JSON.parse(target.dataset.analytics) as TrackDashboardClick;
            if (passedProps.dnt) {
                return;
            }
        } catch (error) {
            log.debug(error);
        }
    }

    let trackingMsg: TrackDashboardClick = {
        path: window.location.pathname,
        label: target.textContent || undefined,
    };

    if (target instanceof HTMLButtonElement || target instanceof HTMLDivElement) {
        //parse button data
        if (target.classList.contains("secondary")) {
            trackingMsg.button_type = "secondary";
        } else {
            trackingMsg.button_type = "primary"; //primary button is the default if secondary is not specified
        }
        //retrieve href if parent is an anchor element
        if (target.parentElement instanceof HTMLAnchorElement) {
            const anchor = target.parentElement as HTMLAnchorElement;
            trackingMsg.destination = anchor.href;
        }
    }

    if (target instanceof HTMLAnchorElement) {
        const anchor = target as HTMLAnchorElement;
        trackingMsg.destination = anchor.href;
    }

    const getAncestorProps = (curr: HTMLElement | null): TrackDashboardClick | undefined => {
        if (!curr || curr instanceof Document) {
            return;
        }
        const ancestorProps: TrackDashboardClick | undefined = getAncestorProps(curr.parentElement);
        const currProps = JSON.parse(curr.dataset.analytics || "{}") as TrackDashboardClick;
        return { ...ancestorProps, ...currProps };
    };

    const ancestorProps = getAncestorProps(target);

    //props that were passed directly to the event target take precedence over those passed to ancestor elements, which take precedence over those implicitly determined.
    trackingMsg = { ...trackingMsg, ...ancestorProps, ...passedProps };

    trackEventInternal("dashboard_clicked", trackingMsg);
};

//call this when the path changes. Complete page call is unnecessary for SPA after initial call
export const trackPathChange = (props: TrackPathChanged) => {
    trackEventInternal("path_changed", props);
};

type TrackLocationProperties = {
    referrer: string;
    path: string;
    host: string;
    url: string;
};

export const trackLocation = async (includePII: boolean) => {
    const props: TrackLocationProperties = {
        referrer: document.referrer,
        path: window.location.pathname,
        host: window.location.hostname,
        url: window.location.href,
    };

    sendAnalytics("trackLocation", {
        //if the user is authenticated, let server determine the id. else, pass anonymousId explicitly.
        includePII: includePII,
        anonymousId: getAnonymousId(),
        properties: props,
    });
};

export const identifyUser = async (traits: Traits) => {
    sendAnalytics("identifyUser", {
        anonymousId: getAnonymousId(),
        traits: traits,
    });
};

function sendAnalytics(operation: "trackEvent" | "trackLocation" | "identifyUser", message: any) {
    fetch("/_analytics/" + operation, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        credentials: "include",
    });
}

const getCookieConsent = () => {
    return Cookies.get("gp-analytical") === "true";
};

const getAnonymousId = (): string | undefined => {
    if (!getCookieConsent()) {
        //we do not want to read or set the id cookie if we don't have consent
        return;
    }
    let anonymousId = Cookies.get("ajs_anonymous_id");
    if (anonymousId) {
        return anonymousId.replace(/^"(.+(?="$))"$/, "$1"); //strip enclosing double quotes before returning
    } else {
        anonymousId = v4();
        Cookies.set("ajs_anonymous_id", anonymousId, { domain: "." + window.location.hostname, expires: 365 });
    }
    return anonymousId;
};

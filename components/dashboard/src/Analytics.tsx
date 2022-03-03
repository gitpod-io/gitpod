/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { getGitpodService } from './service/service';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import Cookies from 'js-cookie';
import { v4 } from 'uuid';
import { Experiment } from './experiments';

export type Event = 'invite_url_requested' | 'organisation_authorised';
type InternalEvent = Event | 'path_changed' | 'dashboard_clicked';

export type EventProperties = TrackOrgAuthorised | TrackInviteUrlRequested;
type InternalEventProperties = TrackUIExperiments & (EventProperties | TrackDashboardClick | TrackPathChanged);

export interface TrackOrgAuthorised {
    installation_id: string;
    setup_action: string | undefined;
}

export interface TrackInviteUrlRequested {
    invite_url: string;
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

interface TrackUIExperiments {
    ui_experiments?: {};
}

interface Traits {
    unsubscribed_onboarding?: boolean;
    unsubscribed_changelog?: boolean;
    unsubscribed_devx?: boolean;
}

//call this to track all events outside of button and anchor clicks
export const trackEvent = (event: Event, properties: EventProperties) => {
    trackEventInternal(event, properties);
};

const trackEventInternal = (event: InternalEvent, properties: InternalEventProperties) => {
    properties.ui_experiments = Experiment.get();

    getGitpodService().server.trackEvent({
        anonymousId: getAnonymousId(),
        event,
        properties,
    });
};

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
        if (target.classList.contains('secondary')) {
            trackingMsg.button_type = 'secondary';
        } else {
            trackingMsg.button_type = 'primary'; //primary button is the default if secondary is not specified
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
        const currProps = JSON.parse(curr.dataset.analytics || '{}') as TrackDashboardClick;
        return { ...ancestorProps, ...currProps };
    };

    const ancestorProps = getAncestorProps(target);

    //props that were passed directly to the event target take precedence over those passed to ancestor elements, which take precedence over those implicitly determined.
    trackingMsg = { ...trackingMsg, ...ancestorProps, ...passedProps };

    trackEventInternal('dashboard_clicked', trackingMsg);
};

//call this when the path changes. Complete page call is unnecessary for SPA after initial call
export const trackPathChange = (props: TrackPathChanged) => {
    trackEventInternal('path_changed', props);
};

type TrackLocationProperties = TrackUIExperiments & {
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
        ui_experiments: Experiment.get(),
    };

    getGitpodService().server.trackLocation({
        //if the user is authenticated, let server determine the id. else, pass anonymousId explicitly.
        includePII: includePII,
        anonymousId: getAnonymousId(),
        properties: props,
    });
};

export const identifyUser = async (traits: Traits) => {
    getGitpodService().server.identifyUser({
        anonymousId: getAnonymousId(),
        traits: traits,
    });
};

const getAnonymousId = (): string => {
    let anonymousId = Cookies.get('ajs_anonymous_id');
    if (anonymousId) {
        return anonymousId.replace(/^"(.+(?="$))"$/, '$1'); //strip enclosing double quotes before returning
    } else {
        anonymousId = v4();
        Cookies.set('ajs_anonymous_id', anonymousId, { domain: '.' + window.location.hostname, expires: 365 });
    }
    return anonymousId;
};

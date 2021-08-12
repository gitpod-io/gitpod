/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { getGitpodService } from "./service/service";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import Cookies from "js-cookie";
import { v4 } from "uuid";


export type Event = "invite_url_requested" | "organisation_authorised";

export type TrackingMsg = {
  dnt?: boolean,
  path: string,
  button_type?: string,
  label?: string,
  destination?: string
}

//call this to track all events outside of button and anchor clicks
export const trackEvent = (event: Event, properties: any) => {
  getGitpodService().server.trackEvent({
    event: event,
    properties: properties
  })
}

export const getAnonymousId = (): string => {
  let anonymousId = Cookies.get('ajs_anonymous_id');
  if (anonymousId) {
    return anonymousId.replace(/^"(.+(?="$))"$/, '$1'); //strip enclosing double quotes before returning
  }
  else {
    anonymousId = v4();
    Cookies.set('ajs_anonymous_id', anonymousId);
  };
  return anonymousId;
}

export const trackButtonOrAnchor = (target: HTMLAnchorElement | HTMLButtonElement | HTMLDivElement, userKnown: boolean) => {
  //read manually passed analytics props from 'data-analytics' attribute of event target
  let passedProps: TrackingMsg | undefined;
  if (target.dataset.analytics) {
    try {
      passedProps = JSON.parse(target.dataset.analytics) as TrackingMsg;
      if (passedProps.dnt) {
        return;
      }
    } catch (error) {
      log.debug(error);
    }

  }

  let trackingMsg: TrackingMsg = {
    path: window.location.pathname,
    label: target.textContent || undefined
  }

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

  const getAncestorProps = (curr: HTMLElement | null): TrackingMsg | undefined => {
    if (!curr || curr instanceof Document) {
      return;
    }
    const ancestorProps: TrackingMsg | undefined = getAncestorProps(curr.parentElement);
    const currProps = JSON.parse(curr.dataset.analytics || "{}");
    return {...ancestorProps, ...currProps} as TrackingMsg;
  }

  const ancestorProps = getAncestorProps(target);

  //props that were passed directly to the event target take precedence over those passed to ancestor elements, which take precedence over those implicitly determined.
  trackingMsg = {...trackingMsg, ...ancestorProps, ...passedProps};

  //if the user is authenticated, let server determine the id. else, pass anonymousId explicitly.
  if (userKnown) {
    getGitpodService().server.trackEvent({
      event: "dashboard_clicked",
      properties: trackingMsg
    });
  } else {
    getGitpodService().server.trackEvent({
      anonymousId: getAnonymousId(),
      event: "dashboard_clicked",
      properties: trackingMsg
    });
  }
}

//call this when the path changes. Complete page call is unnecessary for SPA after initial call
export const trackPathChange = (props: { prev: string, path: string }) => {
  getGitpodService().server.trackEvent({
    event: "path_changed",
    properties: props
  });
}

export const trackLocation = async (userKnown: boolean) => {
  const props = {
    referrer: document.referrer,
    path: window.location.pathname,
    host: window.location.hostname,
    url: window.location.href
  }
  if (userKnown) {
    //if the user is known, make server call
    getGitpodService().server.trackLocation({
      properties: props
    });
  } else {
    //make privacy preserving page call (automatically interpreted as such by server if anonymousId is passed)
    getGitpodService().server.trackLocation({
      anonymousId: getAnonymousId(),
      properties: props
    });
  }
}
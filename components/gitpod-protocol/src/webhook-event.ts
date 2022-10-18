/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export interface WebhookEvent {
    id: string;
    creationTime: string;
    type: "push" | string;

    /**
     * Typically the webhook installer is referenced here.
     */
    authorizedUserId?: string;

    /**
     * webhook event's payload
     */
    rawEvent: string;

    /**
     * The general status of the received webhook event.
     */
    status: WebhookEvent.Status;

    /**
     * Optional message to help understand errors with handling events.
     */
    message?: string;

    /**
     * If the webhook event is considered to trigger a prebuild, the `prebuildStatus`
     * contains a more specific status.
     */
    prebuildStatus?: WebhookEvent.PrebuildStatus;

    /**
     * If `prebuildStatus` is `prebuild_triggered` this points to a prebuild.
     */
    prebuildId?: string;

    projectId?: string;

    cloneUrl?: string;

    branch?: string;

    commit?: string;
}

export namespace WebhookEvent {
    export type Status = "received" | "dismissed_unauthorized" | "ignored" | "processed";
    export type PrebuildStatus = "ignored_unconfigured" | "prebuild_trigger_failed" | "prebuild_triggered";
}

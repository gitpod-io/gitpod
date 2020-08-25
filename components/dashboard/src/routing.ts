/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export function getStartUrl(workspaceId: string) {
    const startWs = new URL(window.location.href);
    startWs.pathname = '/start/';
    startWs.hash = workspaceId;
    return startWs.toString();
}

export function getWorkspacesUrl() {
    const workspacesUrl = new URL(window.location.href);
    workspacesUrl.pathname = '/workspaces/';
    workspacesUrl.hash = '';
    return workspacesUrl.toString();
}

export function getUsageUrl() {
    const workspacesUrl = new URL(window.location.href);
    workspacesUrl.pathname = '/usage/';
    workspacesUrl.hash = '';
    return workspacesUrl.toString();
}

export function getSubscriptionsUrl() {
    const workspacesUrl = new URL(window.location.href);
    workspacesUrl.pathname = '/subscription/';
    workspacesUrl.hash = '';
    return workspacesUrl.toString();
}

export function getTeamSubscriptionsUrl() {
    const workspacesUrl = new URL(window.location.href);
    workspacesUrl.pathname = '/teams/';
    workspacesUrl.hash = '';
    return workspacesUrl.toString();
}

export function getBlockedUrl() {
    const workspacesUrl = new URL(window.location.href);
    workspacesUrl.pathname = '/blocked/';
    workspacesUrl.hash = '';
    return workspacesUrl.toString();
}
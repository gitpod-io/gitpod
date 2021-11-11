/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { getGitpodService } from "../service/service";

let cache: {
    title: string,
    link: string[]
}[] = []

let menuWithPayment = [
    {
        title: 'Account',
        link: ['/account','/settings']
    },
    {
        title: 'Notifications',
        link: ['/notifications']
    },
    {
        title: 'Plans',
        link: ['/plans']
    },
    {
        title: 'Team Plans',
        link: ['/teams']
    },
    {
        title: 'Variables',
        link: ['/variables']
    },
    {
        title: 'Integrations',
        link: ["/integrations", "/access-control"]
    },
    {
        title: 'Preferences',
        link: ['/preferences']
    },
]

let menuWithoutPayment = menuWithPayment.filter(menu => menu.title !== "Plans" && menu.title !== 'Team Plans')

export async function getMenu() {
    if (cache.length !== 0) {
        return cache
    }
    let show = await getGitpodService().server.getShowPaymentUI()
    if (show === false) {
        cache = menuWithoutPayment
    } else {
        cache = menuWithPayment
    }
    return cache
}

export default [
    {
        title: 'Account',
        link: ['/account','/settings']
    },
    {
        title: 'Notifications',
        link: ['/notifications']
    },
    {
        title: 'Plans',
        link: ['/plans']
    },
    {
        title: 'Team Plans',
        link: ['/teams']
    },
    {
        title: 'Variables',
        link: ['/variables']
    },
    {
        title: 'Integrations',
        link: ["/integrations", "/access-control"]
    },
    {
        title: 'Preferences',
        link: ['/preferences']
    },
];
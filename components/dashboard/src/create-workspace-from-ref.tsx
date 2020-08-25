/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { NoReferrer } from "./components/create/no-referrer";
import withRoot from "./withRoot";

export function start() {
    const contextUrl = document.referrer;
    if (contextUrl === undefined || contextUrl === '') {
        // Opening gitpod.io/ref without context: Show specific error
        const NoReferrerWithRoot = withRoot(NoReferrer);
        ReactDOM.render(<NoReferrerWithRoot />, document.querySelector('#root'));
        return;
    } else {
        // Redirect to gitpod.io/#<contextUrl> to get the same experience as with direct call
        const url = new URL(window.location.toString());
        url.pathname = "/";
        url.hash = contextUrl;
        window.location.href = url.toString();
    }
}

start();
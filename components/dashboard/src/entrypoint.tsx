/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { updateBrowserTab } from "./components/with-branding";
import withRoot from "./withRoot";

export function renderEntrypoint<P>(component: React.ComponentType<P>, props?: P) {
    updateBrowserTab();

    const ComponentWithRoot = withRoot(component);
    ReactDOM.render(
        <ComponentWithRoot {...((props || {}) as P)}/>,
        document.querySelector('#root')
    );
}
/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { CreateErrorRenderer } from './components/create/create-workspace';
import { MenuEntry } from './components/menu';
import { StartErrorRenderer } from './components/start-workspace';
import { Branding } from '@gitpod/gitpod-protocol';

export const Context = React.createContext<Context>({ disabledActions: false })

/**
 * This interface is a quick measure to extract variance from dashboard that we want to have control over for gitpod.io.
 */
export interface Context {
    menuEntries?: (entries: MenuEntry[]) => MenuEntry[];
    renderCreateError?: CreateErrorRenderer;
    renderStartError?: StartErrorRenderer;
    creditAlert?: JSX.Element;
    disabledActions: boolean;
    branding?: Branding;
}

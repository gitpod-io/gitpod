/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PreferenceContribution, PreferenceSchema } from "@theia/core/lib/browser";
import { interfaces } from "inversify";

export const dontAskProperty = 'setup.dontask';

export const setupPreferencesSchema: PreferenceSchema = {
    type: 'object',
    properties: {
        'setup.dontask': {
            type: 'boolean',
            default: false,
            description: 'Controls whether to show a notification for the setup assistant.'
        }
    }
};

export function bindSetupPreferences(bind: interfaces.Bind): void {
    bind(PreferenceContribution).toConstantValue({ schema: setupPreferencesSchema });
}
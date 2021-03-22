/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { SettingsPage } from "./SettingsPage";

export default function EnvVars() {
    return <div>
        <SettingsPage title='Variables' subtitle='Configure environment variables for all workspaces.'>
            <h3>Environment Variables</h3>
        </SettingsPage>
    </div>;
}
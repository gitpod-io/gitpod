/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrgSettingsPage } from "./OrgSettingsPage";
import { OIDCClients } from "./sso/OIDCClients";

export default function SSO() {
    return (
        <OrgSettingsPage>
            <OIDCClients />
        </OrgSettingsPage>
    );
}

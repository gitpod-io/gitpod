/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitIntegrations } from "./git-integrations/GitIntegrations";
import { OrgSettingsPage } from "./OrgSettingsPage";

export default function GitAuthPage() {
    return (
        <OrgSettingsPage title="Git Auth" subtitle="Configure Git Auth for GitLab or Github.">
            <GitIntegrations />
        </OrgSettingsPage>
    );
}

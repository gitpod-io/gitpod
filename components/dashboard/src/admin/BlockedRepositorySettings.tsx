/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";

export function BlockedRepositorySettings() {
    return (
        <PageWithAdminSubMenu title="Blocked Repositories" subtitle="Search and manage all blocked repositories.">
            <div></div>
        </PageWithAdminSubMenu>
    );
}

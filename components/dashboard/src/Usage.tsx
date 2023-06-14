/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCurrentOrg } from "./data/organizations/orgs-query";
import { UsageView } from "./usage/UsageView";

function Usage() {
    const org = useCurrentOrg().data;

    if (!org) {
        return <></>;
    }

    return <UsageView attributionId={{ kind: "team", teamId: org.id }} />;
}

export default Usage;

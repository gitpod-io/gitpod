/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import UsageView from "./components/UsageView";
import { useCurrentTeam } from "./teams/teams-context";
import { useCurrentUser } from "./user-context";

function Usage() {
    const user = useCurrentUser();
    const org = useCurrentTeam();

    if (!user) {
        return <></>;
    }

    let attributionId: AttributionId = { kind: "user", userId: user.id };
    if (org) {
        attributionId = { kind: "team", teamId: org.id };
    }

    return <UsageView attributionId={attributionId} />;
}

export default Usage;

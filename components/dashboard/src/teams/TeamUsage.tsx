/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCurrentTeam } from "./teams-context";
import UsageView from "../components/UsageView";

function TeamUsage() {
    const team = useCurrentTeam();
    if (!team) {
        return <></>;
    }

    return (
        <UsageView
            attributionId={{
                kind: "team",
                teamId: team.id,
            }}
        />
    );
}

export default TeamUsage;

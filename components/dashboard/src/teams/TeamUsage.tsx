/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { useLocation } from "react-router";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import UsageView from "../components/UsageView";

function TeamUsage() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
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

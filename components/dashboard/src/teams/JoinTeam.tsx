/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { publicApiTeamsToProtocol, publicApiTeamToProtocol, teamsService } from "../service/public-api";
import { TeamsContext } from "./teams-context";

export default function () {
    const { setTeams } = useContext(TeamsContext);
    const history = useHistory();

    const [joinError, setJoinError] = useState<Error>();
    const inviteId = new URL(window.location.href).searchParams.get("inviteId");

    useEffect(() => {
        (async () => {
            try {
                if (!inviteId) {
                    throw new Error("This invite URL is incorrect.");
                }

                const team = publicApiTeamToProtocol((await teamsService.joinTeam({ invitationId: inviteId })).team!);
                const teams = publicApiTeamsToProtocol((await teamsService.listTeams({})).teams);

                setTeams(teams);

                history.push(`/t/${team.slug}/members`);
            } catch (error) {
                console.error(error);
                setJoinError(error);
            }
        })();
    }, []);

    useEffect(() => {
        document.title = "Joining Organization — Gitpod";
    }, []);

    return joinError ? <div className="mt-16 text-center text-gitpod-red">{String(joinError)}</div> : <></>;
}

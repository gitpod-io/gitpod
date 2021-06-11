/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { getGitpodService } from "../service/service";
import { TeamsContext } from "./teams-context";

export default function() {
    const { setTeams } = useContext(TeamsContext);
    const history = useHistory();

    const [ joinError, setJoinError ] = useState<Error>();
    const teamId = new URL(window.location.href).searchParams.get('teamId');

    useEffect(() => {
        (async () => {
            try {
                if (!teamId) {
                    throw new Error('This invite URL is incorrect: No team ID specified');
                }
                await getGitpodService().server.joinTeam(teamId);
                const teams = await getGitpodService().server.getTeams();
                const team = teams.find(t => t.id === teamId);
                if (!team) {
                    throw new Error('Failed to join team. Please contact support.');
                }
                setTeams(teams);
                history.push(`/${team.slug}/members`);
            } catch (error) {
                console.error(error);
                setJoinError(error);
            }
        })();
    }, []);
    return <div className="mt-16 text-center text-gitpod-red">{String(joinError)}</div>
}
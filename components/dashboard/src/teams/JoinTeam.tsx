/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getGitpodService } from '../service/service';
import { TeamsContext } from './teams-context';

export default function () {
    const { setTeams } = useContext(TeamsContext);
    const history = useHistory();

    const [joinError, setJoinError] = useState<Error>();
    const inviteId = new URL(window.location.href).searchParams.get('inviteId');

    useEffect(() => {
        (async () => {
            try {
                if (!inviteId) {
                    throw new Error('This invite URL is incorrect.');
                }

                let team;
                try {
                    team = await getGitpodService().server.joinTeam(inviteId);
                } catch (error) {
                    const message: string | undefined = error && typeof error.message === 'string' && error.message;
                    const regExp = /You are already a member of this team. \((.*)\)/;
                    const match = message && regExp.exec(message);
                    if (match && match[1]) {
                        const slug = match[1];
                        history.push(`/t/${slug}/members`);
                        return;
                    }
                    throw error;
                }
                const teams = await getGitpodService().server.getTeams();
                setTeams(teams);

                history.push(`/t/${team.slug}/members`);
            } catch (error) {
                console.error(error);
                setJoinError(error);
            }
        })();
    }, []);

    useEffect(() => {
        document.title = 'Joining Team — Gitpod';
    }, []);

    return joinError ? <div className="mt-16 text-center text-gitpod-red">{String(joinError)}</div> : <></>;
}

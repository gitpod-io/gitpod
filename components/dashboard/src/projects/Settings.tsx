/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect } from "react";
import { useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";

export default function () {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const match = useRouteMatch<{ team: string, resource: string }>("/:team/:resource");
    const projectName = match?.params?.resource;
    const team = getCurrentTeam(location, teams);


    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
        })();
    }, [team]);

    return <>
        <Header title="Settings" subtitle={`Settings for ${projectName}`} />
        <div className="lg:px-28 px-10">

        </div>
    </>;
}
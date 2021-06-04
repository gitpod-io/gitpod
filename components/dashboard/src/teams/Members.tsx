/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TeamMemberInfo } from "@gitpod/gitpod-protocol";
import moment from "moment";
import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import Header from "../components/Header";
import { getGitpodService } from "../service/service";
import { TeamsContext, getCurrentTeam } from "./teams-context";


export default function() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [ members, setMembers ] = useState<TeamMemberInfo[]>([]);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const infos = await getGitpodService().server.getTeamMembers(team.id);
            setMembers(infos);
        })();
    }, [ team ]);

    return <>
        <Header title="Members" subtitle="Manage team members." />
        <div className="lg:px-28 px-10">
            <div className="mt-2 grid grid-cols-3 px-6 py-2 font-semibold border-t border-b border-gray-200 dark:border-gray-800">
                <p className="pl-14">Name</p>
                <p>Joined</p>
                <p>Role</p>
            </div>
            {members.map(m => <div className="mt-2 grid grid-cols-3 p-6 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
                <div className="flex items-center">
                    <div className="w-14">{m.avatarUrl && <img className="rounded-full w-8 h-8" src={m.avatarUrl || ''} alt={m.fullName} />}</div>
                    <div>
                        <div className="text-base text-gray-900 dark:text-gray-50 font-medium">{m.fullName}</div>
                        <p>{m.primaryEmail}</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <div className="text-gray-400">{moment(m.memberSince).fromNow()}</div>
                </div>
                <div className="flex items-center">
                    <div className=" text-gray-400">Owner</div>
                </div>
            </div>)}
        </div>
    </>;
}
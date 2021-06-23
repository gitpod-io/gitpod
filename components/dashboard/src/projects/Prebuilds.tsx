/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuildInfo, ProjectInfo } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import DropDown from "../components/DropDown";
import { ItemsList, Item, ItemField, ItemFieldContextMenu, ItemFieldIcon } from "../components/ItemsList";
import { getGitpodService } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";

export default function () {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const match = useRouteMatch<{ team: string, resource: string }>("/:team/:resource");
    const projectName = match?.params?.resource;
    const team = getCurrentTeam(location, teams);

    const [project, setProject] = useState<ProjectInfo | undefined>();

    const [prebuilds, setPrebuilds] = useState<PrebuildInfo[]>([]);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const projects = await getGitpodService().server.getProjects(team.id);

            const project = projects.find(p => p.name === projectName);
            if (project) {
                setProject(project);
                // setPrebuilds(await getGitpodService().server.getPrebuilds(team.id, project.id));
                setPrebuilds([{
                    id: "123",
                    branch: "feature-branch",
                    cloneUrl: "http://github.com/cool-test-org/foo",
                    startedAt: "2021-06-21T08:45:16.807Z",
                    startedBy: "AlexTugarev",
                    project: "lama",
                    status: "available",
                    teamId: "ACME"
                }, {
                    id: "123",
                    branch: "feature-branch",
                    cloneUrl: "http://github.com/cool-test-org/foo",
                    startedAt: "2021-06-20T08:45:16.807Z",
                    startedBy: "AlexTugarev",
                    project: "lama",
                    status: "available",
                    teamId: "ACME"
                }])
            }
        })();
    }, [team]);

    return <>
        <Header title="Prebuilds" subtitle={`Prebuild for ${project?.name}`} />
        <div className="lg:px-28 px-10">
            <div className="flex mt-8">
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" /></svg>
                    </div>
                    <input type="search" placeholder="Search" onChange={() => { /* TODO */ }} />
                </div>
                <div className="flex-1" />
                <div className="py-3 pl-3">
                    <DropDown prefix="Status: " contextMenuWidth="w-32" activeEntry={'All'} entries={[{
                        title: 'All',
                        onClick: () => { /* TODO */ }
                    }]} />
                </div>
            </div>
            <ItemsList className="mt-2">
                <Item header={true} className="grid grid-cols-4">
                    <ItemField className="w-5">
                    </ItemField>
                    <ItemField>
                        <span>Context</span>
                    </ItemField>
                    <ItemField>
                        <span>Started</span>
                    </ItemField>
                    <ItemField className="flex items-center">
                        <span className="flex-grow">Status</span>
                        <ItemFieldContextMenu />
                    </ItemField>
                </Item>
                {prebuilds.map(p => <Item className="grid grid-cols-4">
                    <ItemFieldIcon className="w-5">
                        <div className={"rounded-full w-3 h-3 text-sm align-middle m-auto " + (true ? "bg-green-500" : "bg-gray-400")}>
                            &nbsp;
                        </div>
                    </ItemFieldIcon>
                    <ItemField className="flex items-center">
                        <div>
                            <div className="text-base text-gray-900 dark:text-gray-50 font-medium">{p.branch}</div>
                            <p>{p.cloneUrl}</p>
                        </div>
                    </ItemField>
                    <ItemField>
                        <div>
                            <div className="text-base text-gray-900 dark:text-gray-50 font-medium">{moment(p.startedAt).fromNow()}</div>
                            <p>{p.startedBy}</p>
                        </div>
                    </ItemField>
                    <ItemField className="flex items-center">
                        <span className="text-gray-400 flex-grow capitalize">{p.status}</span>
                    </ItemField>
                </Item>)}
            </ItemsList>
        </div>

    </>;
}
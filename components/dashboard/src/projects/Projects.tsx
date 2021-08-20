/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import projectsEmpty from '../images/projects-empty.svg';
import projectsEmptyDark from '../images/projects-empty-dark.svg';
import { useHistory, useLocation } from "react-router";
import { useContext, useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { ThemeContext } from "../theme-context";
import { PrebuildInfo, Project } from "@gitpod/gitpod-protocol";
import DropDown from "../components/DropDown";
import { toRemoteURL } from "./render-utils";
import ContextMenu from "../components/ContextMenu";

export default function () {
    const location = useLocation();
    const history = useHistory();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);
    const [ projects, setProjects ] = useState<Project[]>([]);
    const [ lastPrebuilds, setLastPrebuilds ] = useState<Map<string, PrebuildInfo>>(new Map());

    const { isDark } = useContext(ThemeContext);

    useEffect(() => {
        updateProjects();
    }, [ teams ]);

    const updateProjects = async () => {
        if (!teams) {
            return;
        }
        const infos = (!!team
            ? await getGitpodService().server.getTeamProjects(team.id)
            : await getGitpodService().server.getUserProjects());
        setProjects(infos);

        for (const p of infos) {
            const lastPrebuild = await getGitpodService().server.findPrebuilds({
                projectId: p.id,
                latest: true,
            });
            if (lastPrebuild[0]) {
                setLastPrebuilds(prev => new Map(prev).set(p.id, lastPrebuild[0]));
            }
        }
    }

    const newProjectUrl = !!team ? `/new?team=${team.slug}` : '/new';
    const onSearchProjects = (searchString: string) => { }
    const onNewProject = () => {
        history.push(newProjectUrl);
    }

    const viewAllPrebuilds = (p: Project) => {
        history.push(`/${!!team ? team.slug : 'projects'}/${p.name}/prebuilds`);
    }

    const onRemoveProject = async (p: Project) => {
        await getGitpodService().server.deleteProject(p.id);
        await updateProjects();
    }

    return <>
        <Header title="Projects" subtitle="Manage recently added projects." />
        {projects.length < 1 && (
            <div>
                <img alt="Projects (empty)" className="h-44 mt-24 mx-auto" role="presentation" src={isDark ? projectsEmptyDark : projectsEmpty} />
                <h3 className="text-center text-gray-500 mt-8">No Recent Projects</h3>
                <p className="text-center text-base text-gray-500 mt-4">Add projects to enable and manage Prebuilds.<br /><a className="gp-link" href="https://www.gitpod.io/docs/prebuilds/">Learn more about Prebuilds</a></p>
                <div className="flex space-x-2 justify-center mt-7">
                    <Link to={newProjectUrl}><button>New Project</button></Link>
                    {team && <Link to="./members"><button className="secondary">Invite Members</button></Link>}
                </div>
            </div>

        )}
        {projects.length > 0 && (
            <div className="lg:px-28 px-10">
                <div className="mt-8 pb-2 flex border-b border-gray-200 dark:border-gray-800">
                    <div className="flex">
                        <div className="py-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" /></svg>
                        </div>
                        <input type="search" placeholder="Search Projects" onChange={(e) => onSearchProjects(e.target.value)} />
                    </div>
                    <div className="flex-1" />
                    <div className="py-3 pl-3">
                        <DropDown prefix="Status: " contextMenuWidth="w-32" activeEntry={'Recent'} entries={[{
                            title: 'Recent',
                            onClick: () => { /* TODO */ }
                        }, {
                            title: 'All',
                            onClick: () => { /* TODO */ }
                        }]} />
                    </div>
                    <Link to="./members" className="flex"><button className="ml-2 secondary">Invite Members</button></Link>
                    <button className="ml-2" onClick={() => onNewProject()}>New Project</button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                    {projects.map(p => (<div key={`project-${p.id}`} className="h-48">
                        <div className="h-5/6 border border-gray-200 dark:border-gray-800 rounded-t-xl">
                            <div className="h-3/4 p-6">
                                <div className="flex self-center text-base text-gray-900 dark:text-gray-50 font-medium">
                                    <Link to={`/${!!team ? team.slug : 'projects'}/${p.name}`}>
                                        {p.name}
                                    </Link>
                                    <span className="flex-grow" />
                                    <div className="justify-end">
                                        <ContextMenu menuEntries={[{
                                            title: "Remove Project",
                                            customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
                                            onClick: () => onRemoveProject(p)
                                        }]} />
                                    </div>
                                </div>
                                <p>{toRemoteURL(p.cloneUrl)}</p>
                            </div>
                            <div className="h-1/4 px-6 py-1"><p>__ Active Branches</p></div>
                        </div>
                        <div className="h-1/6 px-6 border rounded-b-xl dark:border-gray-800 bg-gray-200 cursor-pointer" onClick={() => viewAllPrebuilds(p)}>
                            {lastPrebuilds.get(p.id)
                                ? (<div className="flex flex-row space-x-3 h-full text-sm">
                                    <div className={"my-auto rounded-full w-3 h-3 text-sm align-middle " + (true ? "bg-green-500" : "bg-gray-400")}>
                                        &nbsp;
                                    </div>
                                    <div className="my-auto">{lastPrebuilds.get(p.id)!.branch}</div>
                                    <div className="my-auto text-gray-400">{moment(lastPrebuilds.get(p.id)!.startedAt, "YYYYMMDD").fromNow()}</div>
                                    <div className="my-auto text-gray-400 flex-grow text-right">View All ⟶</div>
                                </div>)
                                : (<div className="flex h-full text-md">
                                    <p className="my-auto ">No recent prebuilds</p>
                                </div>)}
                        </div>
                    </div>))}
                    <div key="new-project"
                        className="h-48 border-dashed border-2 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl focus:bg-gitpod-kumquat-light transition ease-in-out group">
                        <Link to={newProjectUrl}>
                            <div className="flex h-full">
                                <div className="m-auto">New Project</div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        )}
    </>;
}
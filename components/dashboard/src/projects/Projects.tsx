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
import { PrebuildInfo, PrebuiltWorkspaceState, Project } from "@gitpod/gitpod-protocol";
import { toRemoteURL } from "./render-utils";
import ContextMenu from "../components/ContextMenu";
import StatusDone from "../icons/StatusDone.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";
import StatusFailed from "../icons/StatusFailed.svg";

export default function () {
    const location = useLocation();
    const history = useHistory();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);
    const [ projects, setProjects ] = useState<Project[]>([]);
    const [ lastPrebuilds, setLastPrebuilds ] = useState<Map<string, PrebuildInfo>>(new Map());

    const { isDark } = useContext(ThemeContext);

    const [searchFilter, setSearchFilter] = useState<string | undefined>();

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
    const onNewProject = () => {
        history.push(newProjectUrl);
    }

    const onRemoveProject = async (p: Project) => {
        await getGitpodService().server.deleteProject(p.id);
        await updateProjects();
    }

    const filter = (project: Project) => {
        if (searchFilter && `${project.name}`.toLowerCase().includes(searchFilter.toLowerCase()) === false) {
            return false;
        }
        return true;
    }

    const teamOrUserSlug = !!team ? team.slug : 'projects';

    const getPrebuildStatusIcon = (status: PrebuiltWorkspaceState) => {
        switch (status) {
            case undefined: // Fall through
            case "queued":
                return StatusPaused;
            case "building":
                return StatusRunning;
            case "aborted": // Fall through
            case "timeout":
                return StatusFailed;
            case "available":
                return StatusDone;
        }
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
                        <input type="search" placeholder="Search Projects" onChange={e => setSearchFilter(e.target.value)} />
                    </div>
                    <div className="flex-1" />
                    <div className="py-3 pl-3">
                    </div>
                    <Link to="./members" className="flex"><button className="ml-2 secondary">Invite Members</button></Link>
                    <button className="ml-2" onClick={() => onNewProject()}>New Project</button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                    {projects.filter(filter).map(p => (<div key={`project-${p.id}`} className="h-52">
                        <div className="h-42 border border-gray-100 dark:border-gray-800 rounded-t-xl">
                            <div className="h-32 p-6">
                                <div className="flex text-xl font-semibold text-gray-700 dark:text-gray-200 font-medium">
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
                                <a href={p.cloneUrl.replace(/\.git$/, '')}>
                                    <p className="hover:text-gray-600 dark:hover:text-gray-400 dark:text-gray-500">{toRemoteURL(p.cloneUrl)}</p>
                                </a>
                            </div>
                            <div className="h-10 px-6 py-1 text-gray-400 text-sm">
                                <span className="hover:text-gray-600 dark:hover:text-gray-300">
                                    <Link to={`/${teamOrUserSlug}/${p.name}`}>
                                        Branches
                                    </Link>
                                </span>
                                <span className="mx-2 my-auto">·</span>
                                <span className="hover:text-gray-600 dark:hover:text-gray-300">
                                    <Link to={`/${teamOrUserSlug}/${p.name}/prebuilds`}>
                                        Prebuilds
                                    </Link>
                                </span>
                            </div>
                        </div>
                        <div className="h-10 px-4 border rounded-b-xl dark:border-gray-800 bg-gray-100 border-gray-100 dark:bg-gray-800">
                            {lastPrebuilds.get(p.id)
                                ? (<div className="flex flex-row h-full text-sm justify-between">
                                    <Link to={`/${teamOrUserSlug}/${p.name}/${lastPrebuilds.get(p.id)!.id}`} className="flex my-auto group space-x-2">
                                        <img className="h-3 w-3 my-auto" src={getPrebuildStatusIcon(lastPrebuilds.get(p.id)!.status)} />
                                        <div className="my-auto font-semibold text-gray-500">{lastPrebuilds.get(p.id)!.branch}</div>
                                        <span className="mx-1 my-auto text-gray-600">·</span>
                                        <div className="my-auto text-gray-400 flex-grow hover:text-gray-800 dark:hover:text-gray-300">{moment(lastPrebuilds.get(p.id)!.startedAt, "YYYYMMDD").fromNow()}</div>
                                    </Link>
                                    <Link to={`/${teamOrUserSlug}/${p.name}/prebuilds`} className="my-auto group">
                                        <div className="flex my-auto text-gray-400 flex-grow text-right group-hover:text-gray-600 dark:hover:text-gray-300">View All &rarr;</div>
                                    </Link>
                                </div>)
                                : (<div className="flex h-full text-md">
                                    <p className="my-auto ">No recent prebuilds</p>
                                </div>)}
                        </div>
                    </div>))}
                    {!searchFilter && (
                        <div key="new-project"
                            className="h-52 border-dashed border-2 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl focus:bg-gitpod-kumquat-light transition ease-in-out group">
                            <Link to={newProjectUrl}>
                                <div className="flex h-full">
                                    <div className="m-auto">New Project</div>
                                </div>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        )}
    </>;
}
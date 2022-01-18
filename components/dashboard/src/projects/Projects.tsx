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
import { PrebuildWithStatus, Project } from "@gitpod/gitpod-protocol";
import { toRemoteURL } from "./render-utils";
import ContextMenu from "../components/ContextMenu";
import ConfirmationModal from "../components/ConfirmationModal"
import { prebuildStatusIcon } from "./Prebuilds";

export default function () {
    const location = useLocation();
    const history = useHistory();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);
    const [ projects, setProjects ] = useState<Project[]>([]);
    const [ lastPrebuilds, setLastPrebuilds ] = useState<Map<string, PrebuildWithStatus>>(new Map());

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

        const map = new Map();
        await Promise.all(infos.map(async (p) => {
            try {
                const lastPrebuild = await getGitpodService().server.findPrebuilds({
                    projectId: p.id,
                    latest: true,
                });
                if (lastPrebuild[0]) {
                    map.set(p.id, lastPrebuild[0]);
                }
            } catch (error) {
                console.error('Failed to load prebuilds for project', p, error);
            }
        }));
        setLastPrebuilds(map);
    }

    const newProjectUrl = !!team ? `/new?team=${team.slug}` : '/new?user=1';
    const onNewProject = () => {
        history.push(newProjectUrl);
    }

    const onRemoveProject = async (p: Project) => {
        setRemoveModalVisible(false)
        await getGitpodService().server.deleteProject(p.id);
        await updateProjects();
    }

    const filter = (project: Project) => {
        if (searchFilter && `${project.name}`.toLowerCase().includes(searchFilter.toLowerCase()) === false) {
            return false;
        }
        return true;
    }

    function hasNewerPrebuild(p0: Project, p1: Project): number {
        return moment(lastPrebuilds.get(p1.id)?.info?.startedAt || '1970-01-01').diff(moment(lastPrebuilds.get(p0.id)?.info?.startedAt || '1970-01-01'));
    }

    let [ isRemoveModalVisible, setRemoveModalVisible ] = useState(false);
    let [ removeProjectHandler, setRemoveProjectHandler ] = useState<() => void>(()=> () => {})
    let [ willRemoveProject, setWillRemoveProject ] = useState<Project>()

    function renderProjectLink(project: Project): React.ReactElement {
        let slug = '';
        const name = project.name;

        if (project.slug) {
            slug = project.slug;
        } else {
            // For existing GitLab projects that don't have a slug yet
            slug = name;
        }

        return (
            <Link to={`/${teamOrUserSlug}/${slug}`}>
                <span className="text-xl font-semibold">{name}</span>
            </Link>)
    }

    const teamOrUserSlug = !!team ? 't/' + team.slug : 'projects';

    return <>

        {isRemoveModalVisible && <ConfirmationModal
            title="Remove Project"
            areYouSureText="Are you sure you want to remove this project from this team? Team members will also lose access to this project."
            children={{
                name: willRemoveProject?.name ?? "",
                description: willRemoveProject?.cloneUrl ?? "",
            }}
            buttonText="Remove Project"
            visible={isRemoveModalVisible}
            onClose={() => setRemoveModalVisible(false)}
            onConfirm={removeProjectHandler}
        />}
        <Header title="Projects" subtitle="Manage recently added projects." />
        {projects.length === 0 && (
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
            <div className="app-container">
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
                    {team && <Link to="./members" className="flex"><button className="ml-2 secondary">Invite Members</button></Link>}
                    <button className="ml-2" onClick={() => onNewProject()}>New Project</button>
                </div>
                <div className="mt-4 grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 pb-40">
                    {projects.filter(filter).sort(hasNewerPrebuild).map(p => (<div key={`project-${p.id}`} className="h-52">
                        <div className="h-42 border border-gray-100 dark:border-gray-800 rounded-t-xl">
                            <div className="h-32 p-6">
                                <div className="flex text-gray-700 dark:text-gray-200 font-medium">
                                    {renderProjectLink(p)}
                                    <span className="flex-grow" />
                                    <div className="justify-end">
                                        <ContextMenu menuEntries={[
                                            {
                                                title: "New Workspace",
                                                href: `/#${p.cloneUrl}`,
                                                separator: true,
                                            },
                                            {
                                                title: "Remove Project",
                                                customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
                                                onClick: () => {
                                                    setWillRemoveProject(p)
                                                    setRemoveProjectHandler(() => () => {
                                                        onRemoveProject(p)
                                                    })
                                                    setRemoveModalVisible(true)
                                                }
                                            },
                                        ]} />
                                    </div>
                                </div>
                                <a href={p.cloneUrl.replace(/\.git$/, '')}>
                                    <p className="hover:text-gray-600 dark:hover:text-gray-400 dark:text-gray-500 pr-10 truncate">{toRemoteURL(p.cloneUrl)}</p>
                                </a>
                            </div>
                            <div className="h-10 px-6 py-1 text-gray-400 text-sm">
                                <span className="hover:text-gray-600 dark:hover:text-gray-300">
                                    <Link to={`/${teamOrUserSlug}/${p.slug || p.name}`}>
                                        Branches
                                    </Link>
                                </span>
                                <span className="mx-2 my-auto">·</span>
                                <span className="hover:text-gray-600 dark:hover:text-gray-300">
                                    <Link to={`/${teamOrUserSlug}/${p.slug || p.name}/prebuilds`}>
                                        Prebuilds
                                    </Link>
                                </span>
                            </div>
                        </div>
                        <div className="h-10 px-4 border rounded-b-xl dark:border-gray-800 bg-gray-100 border-gray-100 dark:bg-gray-800">
                            {lastPrebuilds.get(p.id)
                                ? (<div className="flex flex-row h-full text-sm space-x-4">
                                    <Link to={`/${teamOrUserSlug}/${p.slug || p.name}/${lastPrebuilds.get(p.id)?.info?.id}`} className="flex-grow flex items-center group space-x-2 truncate">
                                        {prebuildStatusIcon(lastPrebuilds.get(p.id))}
                                        <div className="font-semibold text-gray-500 dark:text-gray-400 truncate" title={lastPrebuilds.get(p.id)?.info?.branch}>{lastPrebuilds.get(p.id)?.info?.branch}</div>
                                        <span className="flex-shrink-0 mx-1 text-gray-400 dark:text-gray-600">·</span>
                                        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-800 dark:group-hover:text-gray-300">{moment(lastPrebuilds.get(p.id)?.info?.startedAt).fromNow()}</div>
                                    </Link>
                                    <Link to={`/${teamOrUserSlug}/${p.slug || p.name}/prebuilds`} className="flex-shrink-0 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">View All &rarr;</Link>
                                </div>)
                                : (<div className="flex h-full text-md">
                                    <p className="my-auto ">No recent prebuilds</p>
                                </div>)}
                        </div>
                    </div>))}
                    {!searchFilter && (
                        <div key="new-project"
                            className="h-52 border-dashed border-2 border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl focus:bg-gitpod-kumquat-light transition ease-in-out group">
                            <Link to={newProjectUrl} data-analytics='{"button_type":"card"}'>
                                <div className="flex h-full">
                                    <div className="m-auto text-gray-400 dark:text-gray-600">New Project</div>
                                </div>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        )}
    </>;
}

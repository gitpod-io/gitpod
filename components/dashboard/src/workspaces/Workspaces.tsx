/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Project, Team, WhitelistedRepository, Workspace, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import Header from "../components/Header";
import DropDown from "../components/DropDown";
import { WorkspaceModel } from "./workspace-model";
import { WorkspaceEntry } from "./WorkspaceEntry";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { StartWorkspaceModal, WsStartEntry } from "./StartWorkspaceModal";
import { ItemsList } from "../components/ItemsList";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { useLocation, useRouteMatch } from "react-router";
import { toRemoteURL } from "../projects/render-utils";
import { Link, useHistory } from "react-router-dom";

export interface WorkspacesProps {
}

export interface WorkspacesState {
    workspaces: WorkspaceInfo[];
    isTemplateModelOpen: boolean;
    repos: WhitelistedRepository[];
}

export default function () {
    const location = useLocation();
    const history = useHistory();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);
    const match = useRouteMatch<{ team: string, resource: string }>("/(t/)?:team/:resource");
    const projectName = match?.params?.resource !== 'workspaces' ? match?.params?.resource : undefined;
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeWorkspaces, setActiveWorkspaces] = useState<WorkspaceInfo[]>([]);
    const [inactiveWorkspaces, setInactiveWorkspaces] = useState<WorkspaceInfo[]>([]);
    const [repos, setRepos] = useState<WhitelistedRepository[]>([]);
    const [isTemplateModelOpen, setIsTemplateModelOpen] = useState<boolean>(false);
    const [workspaceModel, setWorkspaceModel] = useState<WorkspaceModel>();
    const [teamsProjects, setTeamsProjects] = useState<Project[]>([]);
    const [teamsWorkspaceModel, setTeamsWorkspaceModel] = useState<WorkspaceModel|undefined>();
    const [teamsActiveWorkspaces, setTeamsActiveWorkspaces] = useState<WorkspaceInfo[]>([]);

    const newProjectUrl = !!team ? `/new?team=${team.slug}` : '/new';
    const onNewProject = () => {
        history.push(newProjectUrl);
    }

    const fetchTeamsProjects = async () => {
        const projectsPerTeam = await Promise.all((teams || []).map(t => getGitpodService().server.getTeamProjects(t.id)));
        const allTeamsProjects = projectsPerTeam.flat(1);
        setTeamsProjects(allTeamsProjects);
        return allTeamsProjects;
    }

    useEffect(() => {
        // only show example repos on the global user context
        if (!team && !projectName) {
            getGitpodService().server.getFeaturedRepositories().then(setRepos);
        }
        (async () => {
            const projects = (!!team
                ? await getGitpodService().server.getTeamProjects(team.id)
                : await getGitpodService().server.getUserProjects());

            let project: Project | undefined = undefined;
            if (projectName) {
                project = projects.find(p => p.name === projectName);
                if (project) {
                    setProjects([project]);
                }
            } else {
                setProjects(projects);
            }
            let workspaceModel;
            if (!!project) {
                workspaceModel = new WorkspaceModel(setActiveWorkspaces, setInactiveWorkspaces, Promise.resolve([project.id]), false);
            } else if (!!team) {
                workspaceModel = new WorkspaceModel(setActiveWorkspaces, setInactiveWorkspaces, getGitpodService().server.getTeamProjects(team?.id).then(projects => projects.map(p => p.id)), false);
            } else {
                workspaceModel = new WorkspaceModel(setActiveWorkspaces, setInactiveWorkspaces, getGitpodService().server.getUserProjects().then(projects => projects.map(p => p.id)), true);
                // Don't await
                const teamsProjectIdsPromise = fetchTeamsProjects().then(tp => tp.map(p => p.id));
                setTeamsWorkspaceModel(new WorkspaceModel(setTeamsActiveWorkspaces, () => {}, teamsProjectIdsPromise, false));
            }
            setWorkspaceModel(workspaceModel);
        })();
    }, [teams, location]);

    const showStartWSModal = () => setIsTemplateModelOpen(true);
    const hideStartWSModal = () => setIsTemplateModelOpen(false);

    const getRecentSuggestions: () => WsStartEntry[] = () => {
        if (projectName || team) {
            return projects.map(p => {
                const remoteUrl = toRemoteURL(p.cloneUrl);
                return {
                    title: (team ? team.name + '/' : '') + p.name,
                    description: remoteUrl,
                    startUrl: gitpodHostUrl.withContext(remoteUrl).toString()
                };
            });
        }
        if (workspaceModel) {
            const all = workspaceModel.getAllFetchedWorkspaces();
            if (all && all.size > 0) {
                const index = new Map<string, WsStartEntry & { lastUse: string }>();
                for (const ws of Array.from(all.values())) {
                    const repoUrl = Workspace.getFullRepositoryUrl(ws.workspace);
                    if (repoUrl) {
                        const lastUse = WorkspaceInfo.lastActiveISODate(ws);
                        let entry = index.get(repoUrl);
                        if (!entry) {
                            entry = {
                                title: Workspace.getFullRepositoryName(ws.workspace) || repoUrl,
                                description: repoUrl,
                                startUrl: gitpodHostUrl.withContext(repoUrl).toString(),
                                lastUse,
                            };
                            index.set(repoUrl, entry);
                        } else {
                            if (entry.lastUse.localeCompare(lastUse) < 0) {
                                entry.lastUse = lastUse;
                            }
                        }
                    }
                }
                const list = Array.from(index.values());
                list.sort((a, b) => b.lastUse.localeCompare(a.lastUse));
                return list;
            }
        }
        return [];
    }

    return <>
        <Header title="Workspaces" subtitle="Manage recent and stopped workspaces." />

        {workspaceModel?.initialized && (
            activeWorkspaces.length > 0 || inactiveWorkspaces.length > 0 || workspaceModel.searchTerm ?
                <>
                    <div className="app-container py-2 flex">
                        <div className="flex">
                            <div className="py-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" /></svg>
                            </div>
                            <input type="search" className="text-sm" placeholder="Search Workspaces" onChange={(v) => { if (workspaceModel) workspaceModel.setSearch(v.target.value) }} />
                        </div>
                        <div className="flex-1" />
                        <div className="py-3">
                        </div>
                        <div className="py-3 pl-3">
                            <DropDown prefix="Limit: " contextMenuWidth="w-32" activeEntry={workspaceModel ? workspaceModel?.limit + '' : undefined} entries={[{
                                title: '50',
                                onClick: () => { if (workspaceModel) workspaceModel.limit = 50; }
                            }, {
                                title: '100',
                                onClick: () => { if (workspaceModel) workspaceModel.limit = 100; }
                            }, {
                                title: '200',
                                onClick: () => { if (workspaceModel) workspaceModel.limit = 200; }
                            }]} />
                        </div>
                        <button onClick={showStartWSModal} className="ml-2">New Workspace</button>
                    </div>
                    <ItemsList className="app-container">
                        <div className="border-t border-gray-200 dark:border-gray-800"></div>
                        {
                            teamsWorkspaceModel?.initialized && <ActiveTeamWorkspaces teams={teams} teamProjects={teamsProjects} teamWorkspaces={teamsActiveWorkspaces} />
                        }
                        {
                            activeWorkspaces.map(e => {
                                return <WorkspaceEntry key={e.workspace.id} desc={e} model={workspaceModel} stopWorkspace={wsId => getGitpodService().server.stopWorkspace(wsId)} />
                            })
                        }
                        {
                            activeWorkspaces.length > 0 && <div className="py-6"></div>
                        }
                        {
                            inactiveWorkspaces.length > 0 && <div className="p-3 text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-center">Unpinned workspaces that have been inactive for more than 14 days will be automatically deleted. <a className="gp-link" href="https://www.gitpod.io/docs/life-of-workspace/#garbage-collection">Learn more</a></div>
                        }
                        {
                            inactiveWorkspaces.map(e => {
                                return <WorkspaceEntry key={e.workspace.id} desc={e} model={workspaceModel} stopWorkspace={wsId => getGitpodService().server.stopWorkspace(wsId)} />
                            })
                        }
                    </ItemsList>
                </>
                :
                <div className="app-container flex flex-col space-y-2">
                    <div className="px-6 py-3 flex flex-col text-gray-400 border-t border-gray-200 dark:border-gray-800">
                        {teamsWorkspaceModel?.initialized && <ActiveTeamWorkspaces teams={teams} teamProjects={teamsProjects} teamWorkspaces={teamsActiveWorkspaces} />}
                        <div className="flex flex-col items-center justify-center h-96 w-96 mx-auto">
                            {!!team && projects.length === 0
                            ?<>
                                <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Projects</h3>
                                <div className="text-center pb-6 text-gray-500">This team doesn't have any projects, yet.</div>
                                <span>
                                    <button onClick={onNewProject}>New Project</button>
                                </span>
                            </>
                            :<>
                                <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Workspaces</h3>
                                <div className="text-center pb-6 text-gray-500">Prefix any git repository URL with gitpod.io/# or create a new workspace for a recently used project. <a className="gp-link" href="https://www.gitpod.io/docs/getting-started/">Learn more</a></div>
                                <span>
                                    <button onClick={showStartWSModal}>New Workspace</button>
                                </span>
                            </>}
                        </div>
                    </div>
                </div>
        )}
        <StartWorkspaceModal
            onClose={hideStartWSModal}
            visible={!!isTemplateModelOpen}
            examples={repos && repos.map(r => ({
                title: r.name,
                description: r.description || r.url,
                startUrl: gitpodHostUrl.withContext(r.url).toString()
            }))}
            recent={workspaceModel && activeWorkspaces ?
                getRecentSuggestions()
                : []} />
    </>;

}

function ActiveTeamWorkspaces(props: { teams?: Team[], teamProjects: Project[], teamWorkspaces: WorkspaceInfo[] }) {
    if (!props.teams || props.teamWorkspaces.length === 0) {
        return <></>;
    }
    return <div className="p-3 text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm flex items-center justify-center space-x-1">
        <div className="mr-2 rounded-full w-3 h-3 bg-green-500" />
        <span>There are currently more active workspaces in the following teams:</span>
        <span>{
            props.teams
                .map(t => {
                    const projects = props.teamProjects.filter(p => p.teamId === t.id);
                    const count = props.teamWorkspaces.filter(w => projects.some(p => p.id === w.workspace.projectId)).length;
                    if (count < 1) {
                        return undefined;
                    }
                    return <Link className="gp-link" to={`/t/${t.slug}/workspaces`}>{t.name}</Link>;
                })
                .filter(t => !!t)
                .map((t, i) => <>{i > 0 && <span>, </span>}{t}</>)
        }</span>
    </div>;
}

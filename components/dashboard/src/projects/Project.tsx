/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuildInfo, Project } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import { ItemsList, Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { prebuildStatusIcon, prebuildStatusLabel } from "./Prebuilds";
import { ContextMenuEntry } from "../components/ContextMenu";
import { shortCommitMessage, toRemoteURL } from "./render-utils";

export default function () {
    const history = useHistory();
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const match = useRouteMatch<{ team: string, resource: string }>("/:team/:resource");
    const projectName = match?.params?.resource;
    const team = getCurrentTeam(location, teams);

    const [project, setProject] = useState<Project | undefined>();

    const [branches, setBranches] = useState<Project.BranchDetails[]>([]);
    const [lastPrebuilds, setLastPrebuilds] = useState<Map<string, PrebuildInfo>>(new Map());

    const [searchFilter, setSearchFilter] = useState<string | undefined>();

    useEffect(() => {
        updateProject();
    }, [team]);

    const updateProject = async () => {
        if (!team || !projectName) {
            return;
        }
        const projects = await getGitpodService().server.getProjects(team.id);

        const project = projectName && projects.find(p => p.name === projectName);
        if (!project) {
            return;
        }

        setProject(project);

        const details = await getGitpodService().server.getProjectOverview(team.id, project.name);
        if (details) {
            // default branch on top of the rest
            const branches = details.branches.sort((a, b) => (b.isDefault as any) - (a.isDefault as any)) || [];
            setBranches(branches);

            for (const b of branches) {
                const lastPrebuild = await getGitpodService().server.findPrebuilds({
                    projectName,
                    teamId: team.id,
                    branch: b.name,
                    latest: true,
                });
                if (lastPrebuild[0]) {
                    setLastPrebuilds(prev => new Map(prev).set(b.name, lastPrebuild[0]));
                }
            }
        }

    }

    const branchContextMenu = (branch: Project.BranchDetails) => {
        const entries: ContextMenuEntry[] = [];
        entries.push({
            title: "New Workspace",
            onClick: () => onNewWorkspace(branch)
        });
        entries.push({
            title: "Trigger Prebuild",
            onClick: () => triggerPrebuild(branch),
            separator: true
        });
        entries.push({
            title: "Cancel Prebuild",
            customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
            onClick: () => { }
        })
        return entries;
    }

    const lastPrebuild = (branch: Project.BranchDetails) => lastPrebuilds.get(branch.name);

    const filter = (branch: Project.BranchDetails) => {
        if (searchFilter && `${branch.changeTitle} ${branch.name}`.toLowerCase().includes(searchFilter.toLowerCase()) === false) {
            return false;
        }
        return true;
    }

    const onNewWorkspace = (branch: Project.BranchDetails) => {
        window.location.href = gitpodHostUrl.withContext(`${branch.url}`).toString();
    }

    const triggerPrebuild = (branch: Project.BranchDetails) => {
        if (project) {
            getGitpodService().server.triggerPrebuild(project.id, branch.name)
        }
    }

    const openPrebuild = (pb: PrebuildInfo) => {
        history.push(`/${team?.slug}/${projectName}/${pb.id}`);
    }

    const formatDate = (date: string | undefined) => {
        return date ? moment(date).fromNow() : "";
    }

    return <>
        <Header title={project?.name || ""} subtitle={toRemoteURL(project?.cloneUrl || "")} />
        <div className="lg:px-28 px-10">
            <div className="flex mt-8">
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" /></svg>
                    </div>
                    <input type="search" placeholder="Search Active Branches" onChange={e => setSearchFilter(e.target.value)} />
                </div>
                <div className="flex-1" />
                <div className="py-3 pl-3">
                </div>
            </div>
            <ItemsList className="mt-2">
                <Item header={true} className="grid grid-cols-3">
                    <ItemField>
                        <span>Branch</span>
                    </ItemField>
                    <ItemField>
                        <span>Commit</span>
                    </ItemField>
                    <ItemField>
                        <span>Prebuild</span>
                        <ItemFieldContextMenu />
                    </ItemField>
                </Item>
                {branches.map((branch, index) => {

                    const branchName = branch.name;
                    const prebuild = lastPrebuild(branch);

                    const avatar = branch.changeAuthorAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={branch.changeAuthorAvatar || ''} alt={branch.changeAuthor} />;
                    const statusIcon = prebuild?.status && prebuildStatusIcon(prebuild.status);
                    const status = prebuild?.status && prebuildStatusLabel(prebuild.status);
                    console.log(`status for ${branchName} is ${prebuild?.status} (${lastPrebuilds.size})`)
                    if (!filter(branch)) {
                        // return undefined;
                    }
                    return <Item key={`branch-${index}-${branchName}`} className="grid grid-cols-3 group">
                        <ItemField className="flex items-center">
                            <div>
                                <div className="text-base text-gray-900 dark:text-gray-50 font-medium mb-1">
                                    {branchName}
                                </div>
                                <p>Updated _ minutes ago</p>
                            </div>
                        </ItemField>
                        <ItemField className="flex items-center">
                            <div>
                                <div className="text-base text-gray-500 dark:text-gray-50 font-medium mb-1">{shortCommitMessage(branch.changeTitle)}</div>
                                <p>{avatar}Authored {formatDate(branch.changeDate)} · {branch.changeHash?.substring(0, 8)}</p>
                            </div>
                        </ItemField>
                        <ItemField className="flex items-center">
                            <div className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase mb-1 cursor-pointer" onClick={() => prebuild && openPrebuild(prebuild)}>
                                {prebuild ? (<><div className="inline-block align-text-bottom mr-2 w-4 h-4">{statusIcon}</div>{status}</>) : (<span> </span>)}
                            </div>
                            <span className="flex-grow" />
                            <a href={gitpodHostUrl.withContext(`${branch.url}`).toString()}>
                                <button className={`primary mr-2 py-2 ${branch.isDefault ? "" : "opacity-0"} group-hover:opacity-100`}>New Workspace</button>
                            </a>
                            <ItemFieldContextMenu className="py-0.5" menuEntries={branchContextMenu(branch)} />
                        </ItemField>
                    </Item>
                }
                )}
            </ItemsList>
        </div>

    </>;
}
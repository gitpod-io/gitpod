/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import projectsEmpty from "../images/projects-empty.svg";
import projectsEmptyDark from "../images/projects-empty-dark.svg";
import { useHistory, useLocation } from "react-router";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getGitpodService } from "../service/service";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { ThemeContext } from "../theme-context";
import { PrebuildWithStatus, Project } from "@gitpod/gitpod-protocol";
import Alert from "../components/Alert";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { listAllProjects } from "../service/public-api";
import { UserContext } from "../user-context";
import { ProjectListItem } from "./ProjectListItem";

export default function () {
    const location = useLocation();
    const history = useHistory();

    const { teams } = useContext(TeamsContext);
    const { user } = useContext(UserContext);
    const { usePublicApiProjectsService } = useContext(FeatureFlagContext);
    const team = getCurrentTeam(location, teams);
    const [projectsLoaded, setProjectsLoaded] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [lastPrebuilds, setLastPrebuilds] = useState<Map<string, PrebuildWithStatus>>(new Map());

    const { isDark } = useContext(ThemeContext);

    const [searchFilter, setSearchFilter] = useState<string | undefined>();

    const updateProjects = useCallback(async () => {
        if (!teams) {
            return;
        }

        let infos: Project[];
        if (!!team) {
            infos = usePublicApiProjectsService
                ? await listAllProjects({ teamId: team.id })
                : await getGitpodService().server.getTeamProjects(team.id);
        } else {
            infos = usePublicApiProjectsService
                ? await listAllProjects({ userId: user?.id })
                : await getGitpodService().server.getUserProjects();
        }
        setProjects(infos);
        setProjectsLoaded(true);

        const map = new Map();
        await Promise.all(
            infos.map(async (p) => {
                try {
                    const lastPrebuild = await getGitpodService().server.findPrebuilds({
                        projectId: p.id,
                        latest: true,
                    });
                    if (lastPrebuild[0]) {
                        map.set(p.id, lastPrebuild[0]);
                    }
                } catch (error) {
                    console.error("Failed to load prebuilds for project", p, error);
                }
            }),
        );
        setLastPrebuilds(map);
    }, [team, teams, usePublicApiProjectsService, user?.id]);

    // Reload projects if the team changes
    useEffect(() => {
        updateProjects();
    }, [teams, updateProjects]);

    const newProjectUrl = !!team ? `/new?team=${team.slug}` : "/new?user=1";

    const onNewProject = useCallback(() => {
        history.push(newProjectUrl);
    }, [history, newProjectUrl]);

    // sort/filter projects if anything related changes
    const sortedFilteredProjects = useMemo(() => {
        const filter = (project: Project) => {
            if (searchFilter && `${project.name}`.toLowerCase().includes(searchFilter.toLowerCase()) === false) {
                return false;
            }
            return true;
        };

        const hasNewerPrebuild = (p0: Project, p1: Project): number => {
            return dayjs(lastPrebuilds.get(p1.id)?.info?.startedAt || "1970-01-01").diff(
                dayjs(lastPrebuilds.get(p0.id)?.info?.startedAt || "1970-01-01"),
            );
        };

        return projects.filter(filter).sort(hasNewerPrebuild);
    }, [lastPrebuilds, projects, searchFilter]);

    return (
        <>
            {!team && (
                <div className="app-container pt-2">
                    <Alert type={"message"} closable={false} showIcon={true} className="flex rounded mb-2 w-full">
                        We'll remove projects under personal accounts in Q1'2023.{" "}
                        <Link to="/teams/new" className="gp-link">
                            Create a team
                        </Link>
                    </Alert>
                </div>
            )}
            <Header title="Projects" subtitle="Manage recently added projects." />
            {/* only show if we're not still loading projects to avoid a content flash */}
            {projectsLoaded && projects.length === 0 && (
                <div>
                    <img
                        alt="Projects (empty)"
                        className="h-44 mt-24 mx-auto"
                        role="presentation"
                        src={isDark ? projectsEmptyDark : projectsEmpty}
                    />
                    <h3 className="text-center text-gray-500 mt-8">No Recent Projects</h3>
                    <p className="text-center text-base text-gray-500 mt-4">
                        Add projects to enable and manage Prebuilds.
                        <br />
                        <a className="gp-link" href="https://www.gitpod.io/docs/prebuilds/">
                            Learn more about Prebuilds
                        </a>
                    </p>
                    <div className="flex space-x-2 justify-center mt-7">
                        <Link to={newProjectUrl}>
                            <button>New Project</button>
                        </Link>
                        {team && (
                            <Link to="./members">
                                <button className="secondary">Invite Members</button>
                            </Link>
                        )}
                    </div>
                </div>
            )}
            {projects.length > 0 && (
                <div className="app-container">
                    <div className="mt-8 pb-2 flex border-b border-gray-200 dark:border-gray-800">
                        <div className="flex">
                            <div className="py-4">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 16 16"
                                    width="16"
                                    height="16"
                                >
                                    <path
                                        fill="#A8A29E"
                                        d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                                    />
                                </svg>
                            </div>
                            <input
                                type="search"
                                placeholder="Search Projects"
                                onChange={(e) => setSearchFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex-1" />
                        <div className="py-3 pl-3"></div>
                        {team && (
                            <Link to="./members" className="flex">
                                <button className="ml-2 secondary">Invite Members</button>
                            </Link>
                        )}
                        <button className="ml-2" onClick={() => onNewProject()}>
                            New Project
                        </button>
                    </div>
                    <div className="mt-4 grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 pb-40">
                        {sortedFilteredProjects.map((p) => (
                            <ProjectListItem
                                project={p}
                                key={p.id}
                                prebuild={lastPrebuilds.get(p.id)}
                                onProjectRemoved={updateProjects}
                            />
                        ))}
                        {!searchFilter && (
                            <div
                                key="new-project"
                                className="h-52 border-dashed border-2 border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl focus:bg-gitpod-kumquat-light transition ease-in-out group"
                            >
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
        </>
    );
}

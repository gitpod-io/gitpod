/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Link } from "react-router-dom";
import Header from "../components/Header";
import projectsEmpty from "../images/projects-empty.svg";
import projectsEmptyDark from "../images/projects-empty-dark.svg";
import { useHistory, useLocation } from "react-router";
import { useCallback, useContext, useMemo, useState } from "react";
import { getCurrentTeam, TeamsContext } from "../teams/teams-context";
import { ThemeContext } from "../theme-context";
import { Project } from "@gitpod/gitpod-protocol";
import Alert from "../components/Alert";
import { ProjectListItem } from "./ProjectListItem";
import { SpinnerLoader } from "../components/Loader";
import { useListProjectsQuery } from "../data/projects/list-projects-query";

export default function () {
    const location = useLocation();
    const history = useHistory();
    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);
    const { data, isLoading, isError, refetch } = useListProjectsQuery();
    const { isDark } = useContext(ThemeContext);
    const [searchFilter, setSearchFilter] = useState<string | undefined>();
    const newProjectUrl = useMemo(() => (!!team ? `/new?team=${team.slug}` : "/new?user=1"), [team]);

    const onNewProject = useCallback(() => {
        history.push(newProjectUrl);
    }, [history, newProjectUrl]);

    const filteredProjects = useMemo(() => {
        const filter = (project: Project) => {
            if (searchFilter && `${project.name}`.toLowerCase().includes(searchFilter.toLowerCase()) === false) {
                return false;
            }
            return true;
        };

        return (data?.projects || []).filter(filter);
    }, [data?.projects, searchFilter]);

    return (
        <>
            <Header title="Projects" subtitle="Manage recently added projects." />
            {/* TODO: Add a delay around Spinner so it delays rendering ~ 500ms so we don't flash spinners too often for fast response */}
            {isLoading && <SpinnerLoader />}
            {/* TODO: Look into a more formalized actionable error message component */}
            {isError && (
                <Alert type="error" className="mt-4 items-center">
                    <div className="flex justify-between items-center">
                        <span>There was a problem loading your projects.</span>
                        <button className="primary" onClick={() => refetch()}>
                            Retry
                        </button>
                    </div>
                </Alert>
            )}
            {/* only show if we're not still loading projects to avoid a content flash */}
            {!isLoading && (data?.projects ?? []).length === 0 && (
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
                        <a
                            className="gp-link"
                            target="_blank"
                            rel="noreferrer"
                            href="https://www.gitpod.io/docs/prebuilds/"
                        >
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
            {(data?.projects || []).length > 0 && (
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
                        {filteredProjects.map((p) => (
                            <ProjectListItem
                                project={p}
                                key={p.id}
                                prebuild={data?.latestPrebuilds.get(p.id)}
                                onProjectRemoved={refetch}
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

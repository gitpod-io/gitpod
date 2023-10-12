/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { useCallback, useContext, useMemo, useState } from "react";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import Alert from "../components/Alert";
import Header from "../components/Header";
import { SpinnerLoader } from "../components/Loader";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useListProjectsQuery } from "../data/projects/list-projects-query";
import search from "../icons/search.svg";
import { Heading2 } from "../components/typography/headings";
import projectsEmptyDark from "../images/projects-empty-dark.svg";
import projectsEmpty from "../images/projects-empty.svg";
import { ThemeContext } from "../theme-context";
import { ProjectListItem } from "./ProjectListItem";
import { projectsPathNew } from "./projects.routes";
import { useFeatureFlag } from "../data/featureflag-query";
import { CreateProjectModal } from "./create-project-modal/CreateProjectModal";

export default function ProjectsPage() {
    const createProjectModal = useFeatureFlag("createProjectModal");
    const history = useHistory();
    const team = useCurrentOrg().data;
    const { data, isLoading, isError, refetch } = useListProjectsQuery();
    const { isDark } = useContext(ThemeContext);
    const [searchFilter, setSearchFilter] = useState<string | undefined>();
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    // TODO: remove this once we enable createProjectModal
    const onNewProject = useCallback(() => {
        history.push(projectsPathNew);
    }, [history]);

    const handleProjectCreated = useCallback(
        (project: Project) => {
            history.push(`/projects/${project.id}/settings`);
        },
        [history],
    );

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
                    <Heading2 className="text-center mt-8">No Recent Projects</Heading2>
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
                        {createProjectModal ? (
                            <button className="ml-2" onClick={() => setShowCreateProjectModal(true)}>
                                New Project
                            </button>
                        ) : (
                            <Link to={projectsPathNew}>
                                <button>New Project</button>
                            </Link>
                        )}
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
                    <div className="mt-3 pb-3 flex border-b border-gray-200 dark:border-gray-800">
                        <div className="flex relative h-10 my-auto">
                            <img
                                src={search}
                                title="Search"
                                className="filter-grayscale absolute top-3 left-3"
                                alt="search icon"
                            />
                            <input
                                type="search"
                                className="w-64 pl-9 border-0"
                                placeholder="Filter Projects"
                                onChange={(e) => setSearchFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex-1" />
                        <div className="py-2 pl-3"></div>
                        {team && (
                            <Link to="./members" className="flex">
                                <button className="ml-2 secondary">Invite Members</button>
                            </Link>
                        )}
                        {createProjectModal ? (
                            <button className="ml-2" onClick={() => setShowCreateProjectModal(true)}>
                                New Project
                            </button>
                        ) : (
                            <button className="ml-2" onClick={() => onNewProject()}>
                                New Project
                            </button>
                        )}
                    </div>
                    <div className="mt-4 grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 pb-40">
                        {filteredProjects.map((p) => (
                            <ProjectListItem project={p} key={p.id} onProjectRemoved={refetch} />
                        ))}
                        {!searchFilter && (
                            // TODO: handle opening create project modal here as well
                            <div
                                key="new-project"
                                className="h-52 border-dashed border-2 border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl focus:bg-kumquat-light transition ease-in-out group"
                            >
                                {createProjectModal ? (
                                    // We should be using a button here, but will handle it with the new projects list work
                                    <div
                                        className="cursor-pointer flex h-full"
                                        onClick={() => setShowCreateProjectModal(true)}
                                    >
                                        <div className="m-auto text-gray-400 dark:text-gray-600">New Project</div>
                                    </div>
                                ) : (
                                    <Link to={projectsPathNew} data-analytics='{"button_type":"card"}'>
                                        <div className="flex h-full">
                                            <div className="m-auto text-gray-400 dark:text-gray-600">New Project</div>
                                        </div>
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {createProjectModal && showCreateProjectModal && (
                <CreateProjectModal onClose={() => setShowCreateProjectModal(false)} onCreated={handleProjectCreated} />
            )}
        </>
    );
}

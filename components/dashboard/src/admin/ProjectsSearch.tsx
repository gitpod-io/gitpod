/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

import ProjectDetail from "./ProjectDetail";
import { getGitpodService } from "../service/service";
import { AdminGetListResult, Project } from "@gitpod/gitpod-protocol";
import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";
import Pagination from "../Pagination/Pagination";

export default function ProjectsSearchPage() {
    return (
        <PageWithAdminSubMenu title="Projects" subtitle="Search and manage all projects.">
            <ProjectsSearch />
        </PageWithAdminSubMenu>
    );
}

export function ProjectsSearch() {
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<AdminGetListResult<Project>>({ total: 0, rows: [] });
    const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);
    const [currentProjectOwner, setCurrentProjectOwner] = useState<string | undefined>("");
    const pageLength = 50;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const projectId = location.pathname.split("/")[3];
        if (projectId && searchResult) {
            let currentProject = searchResult.rows.find((project) => project.id === projectId);
            if (currentProject) {
                setCurrentProject(currentProject);
            } else {
                getGitpodService()
                    .server.adminGetProjectById(projectId)
                    .then((project) => setCurrentProject(project))
                    .catch((e) => console.error(e));
            }
        } else {
            setCurrentProject(undefined);
        }
    }, [location]);

    useEffect(() => {
        (async () => {
            if (currentProject) {
                if (currentProject.userId) {
                    const owner = await getGitpodService().server.adminGetUser(currentProject.userId);
                    if (owner) {
                        setCurrentProjectOwner(owner?.name);
                    }
                }
                if (currentProject.teamId) {
                    const owner = await getGitpodService().server.adminGetTeamById(currentProject.teamId);
                    if (owner) {
                        setCurrentProjectOwner(owner?.name);
                    }
                }
            }
        })();
    }, [currentProject]);

    if (currentProject) {
        return <ProjectDetail project={currentProject} owner={currentProjectOwner} />;
    }

    const search = async (page: number = 1) => {
        setSearching(true);
        try {
            const result = await getGitpodService().server.adminGetProjectsBySearchTerm({
                searchTerm,
                limit: pageLength,
                orderBy: "creationTime",
                offset: (page - 1) * pageLength,
                orderDir: "desc",
            });
            setCurrentPage(page);
            setSearchResult(result);
        } finally {
            setSearching(false);
        }
    };

    return (
        <>
            <div className="pt-8 flex">
                <div className="flex justify-between w-full">
                    <div className="flex">
                        <div className="py-4">
                            <svg
                                className={searching ? "animate-spin" : ""}
                                width="16"
                                height="16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                                    fill="#A8A29E"
                                />
                            </svg>
                        </div>
                        <input
                            type="search"
                            placeholder="Search Projects"
                            onKeyDown={(k) => k.key === "Enter" && search()}
                            onChange={(v) => {
                                setSearchTerm(v.target.value.trim());
                            }}
                        />
                    </div>
                    <button disabled={searching} onClick={() => search()}>
                        Search
                    </button>
                </div>
            </div>
            <div className="flex flex-col space-y-2">
                <div className="px-6 py-3 flex justify-between text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                    <div className="w-4/12">Name</div>
                    <div className="w-6/12">Clone URL</div>
                    <div className="w-2/12">Created</div>
                </div>
                {searchResult.rows.map((project) => (
                    <ProjectResultItem project={project} />
                ))}
            </div>
            <Pagination
                currentPage={currentPage}
                setPage={search}
                totalNumberOfPages={Math.ceil(searchResult.total / pageLength)}
            />
        </>
    );

    function ProjectResultItem(p: { project: Project }) {
        return (
            <Link
                key={"pr-" + p.project.name}
                to={"/admin/projects/" + p.project.id}
                data-analytics='{"button_type":"sidebar_menu"}'
            >
                <div className="rounded-xl whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
                    <div className="flex flex-col w-4/12 truncate">
                        <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{p.project.name}</div>
                    </div>
                    <div className="flex flex-col w-6/12 truncate">
                        <div className="text-gray-500 dark:text-gray-100 truncate">{p.project.cloneUrl}</div>
                    </div>
                    <div className="flex w-2/12 self-center">
                        <div className="text-sm w-full text-gray-400 truncate">
                            {dayjs(p.project.creationTime).fromNow()}
                        </div>
                    </div>
                </div>
            </Link>
        );
    }
}

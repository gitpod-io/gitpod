/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

import ProjectDetail from "./ProjectDetail";
import { getGitpodService } from "../service/service";
import { AdminGetListResult, Project } from "@gitpod/gitpod-protocol";
import { AdminPageHeader } from "./AdminPageHeader";
import Pagination from "../Pagination/Pagination";
import { SpinnerLoader } from "../components/Loader";
import searchIcon from "../icons/search.svg";
import Tooltip from "../components/Tooltip";

export default function ProjectsSearchPage() {
    return (
        <AdminPageHeader title="Admin" subtitle="Configure and manage instance settings.">
            <ProjectsSearch />
        </AdminPageHeader>
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    useEffect(() => {
        (async () => {
            if (currentProject) {
                const owner = await getGitpodService().server.adminGetTeamById(currentProject.teamId);
                if (owner) {
                    setCurrentProjectOwner(owner.name);
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
        <div className="app-container">
            <div className="pt-3 mb-3 flex">
                <div className="flex justify-between w-full">
                    <div className="flex relative h-10 my-auto">
                        {searching ? (
                            <span className="filter-grayscale absolute top-3 left-3">
                                <SpinnerLoader small={true} />
                            </span>
                        ) : (
                            <img
                                src={searchIcon}
                                title="Search"
                                className="filter-grayscale absolute top-3 left-3"
                                alt="search icon"
                            />
                        )}
                        <input
                            className="w-64 pl-9 border-0"
                            type="search"
                            placeholder="Search Projects"
                            onKeyDown={(k) => k.key === "Enter" && search()}
                            onChange={(v) => {
                                setSearchTerm(v.target.value.trim());
                            }}
                        />
                    </div>
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
        </div>
    );

    function ProjectResultItem({ project }: { project: Project }) {
        return (
            <Link key={project.id} to={`/admin/projects/${project.id}`} data-analytics='{"button_type":"sidebar_menu"}'>
                <div className="rounded-xl whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-kumquat-light group">
                    <div className="flex flex-col w-4/12 truncate">
                        <div className="font-medium text-gray-800 dark:text-gray-100 truncate">{project.name}</div>
                    </div>
                    <div className="flex flex-col w-6/12 truncate">
                        <div className="text-gray-500 dark:text-gray-100 truncate">{project.cloneUrl}</div>
                    </div>
                    <div className="flex w-2/12 self-center">
                        <Tooltip content={dayjs(project.creationTime).format("MMM D, YYYY")}>
                            <div className="text-sm w-full text-gray-400 truncate">
                                {dayjs(project.creationTime).fromNow()}
                            </div>
                        </Tooltip>
                    </div>
                </div>
            </Link>
        );
    }
}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { useState, useEffect } from "react";

import TeamDetail from "./TeamDetail";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import { getGitpodService } from "../service/service";
import { AdminGetListResult, Team } from "@gitpod/gitpod-protocol";
import Label from "./Label";
import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";
import Pagination from "../Pagination/Pagination";

export default function TeamsSearchPage() {
    return (
        <PageWithAdminSubMenu title="Teams" subtitle="Search and manage teams.">
            <TeamsSearch />
        </PageWithAdminSubMenu>
    );
}

export function TeamsSearch() {
    const location = useLocation();
    const [searching, setSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentTeam, setCurrentTeam] = useState<Team | undefined>(undefined);
    const [searchResult, setSearchResult] = useState<AdminGetListResult<Team>>({ total: 0, rows: [] });
    const pageLength = 50;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const teamId = location.pathname.split("/")[3];
        if (teamId && searchResult) {
            let foundTeam = searchResult.rows.find((team) => team.id === teamId);
            if (foundTeam) {
                setCurrentTeam(foundTeam);
            } else {
                getGitpodService()
                    .server.adminGetTeamById(teamId)
                    .then((team) => setCurrentTeam(team))
                    .catch((e) => console.error(e));
            }
        } else {
            setCurrentTeam(undefined);
        }
    }, [location]);

    if (currentTeam) {
        return <TeamDetail team={currentTeam} />;
    }

    const search = async (page: number = 1) => {
        setSearching(true);
        try {
            const result = await getGitpodService().server.adminGetTeams({
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
                            placeholder="Search Teams"
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
                    <div className="w-7/12">Name</div>
                    <div className="w-5/12 flex items-center">
                        <span>Created</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" className="h-4 w-4" viewBox="0 0 16 16">
                            <path
                                fill="#A8A29E"
                                fill-rule="evenodd"
                                d="M13.366 8.234a.8.8 0 010 1.132l-4.8 4.8a.8.8 0 01-1.132 0l-4.8-4.8a.8.8 0 111.132-1.132L7.2 11.67V2.4a.8.8 0 111.6 0v9.269l3.434-3.435a.8.8 0 011.132 0z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </div>
                </div>
                {searchResult.rows.map((team) => (
                    <TeamResultItem team={team} />
                ))}
            </div>
            <Pagination
                currentPage={currentPage}
                setPage={search}
                totalNumberOfPages={Math.ceil(searchResult.total / pageLength)}
            />
        </>
    );

    function TeamResultItem(props: { team: Team }) {
        return (
            <Link
                key={"pr-" + props.team.name}
                to={"/admin/teams/" + props.team.id}
                data-analytics='{"button_type":"sidebar_menu"}'
            >
                <div className="rounded-xl whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
                    <div className="flex flex-col w-7/12 truncate">
                        <div className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-sm">
                            {props.team.name}
                            {props.team.markedDeleted && <Label text="Deleted" color="red" />}
                        </div>
                    </div>
                    <div className="flex w-5/12 self-center">
                        <div className="text-sm w-full text-gray-400 truncate">
                            {dayjs(props.team.creationTime).format("MMM D, YYYY")}
                        </div>
                    </div>
                </div>
            </Link>
        );
    }
}

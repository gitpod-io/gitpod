/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdminGetListResult, User } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import { SpinnerLoader } from "../components/Loader";
import Pagination from "../Pagination/Pagination";
import { getGitpodService } from "../service/service";
import { AdminPageHeader } from "./AdminPageHeader";
import UserDetail from "./UserDetail";
import searchIcon from "../icons/search.svg";
import Tooltip from "../components/Tooltip";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";

export default function UserSearch() {
    const location = useLocation();
    const [searchResult, setSearchResult] = useState<AdminGetListResult<User>>({ rows: [], total: 0 });
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [currentUser, setCurrentUserState] = useState<User | undefined>(undefined);
    const pageLength = 50;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const userId = location.pathname.split("/")[3];
        if (userId) {
            let user = searchResult.rows.find((u) => u.id === userId);
            if (user) {
                setCurrentUserState(user);
            } else {
                getGitpodService()
                    .server.adminGetUser(userId)
                    .then((user) => setCurrentUserState(user))
                    .catch((e) => console.error(e));
            }
        } else {
            setCurrentUserState(undefined);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    if (currentUser) {
        return <UserDetail user={currentUser} />;
    }

    const search = async (page: number = 1) => {
        setSearching(true);
        try {
            const result = await getGitpodService().server.adminGetUsers({
                searchTerm,
                limit: pageLength,
                orderBy: "creationDate",
                offset: (page - 1) * pageLength,
                orderDir: "desc",
            });
            setSearchResult(result);
            setCurrentPage(page);
        } finally {
            setSearching(false);
        }
    };
    return (
        <AdminPageHeader title="Admin" subtitle="Configure and manage instance settings.">
            <div className="app-container">
                <div className="mb-3 mt-3 flex">
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
                                placeholder="Search users"
                                onKeyDown={(ke) => ke.key === "Enter" && search()}
                                onChange={(v) => {
                                    setSearchTerm(v.target.value.trim());
                                }}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col space-y-2">
                    <div className="px-6 py-3 flex justify-between space-x-2 text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                        <div className="w-7/12">Name</div>
                        <div className="w-5/12 flex items-center">
                            <span>Created</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" className="h-4 w-4" viewBox="0 0 16 16">
                                <path
                                    fill="#A8A29E"
                                    fillRule="evenodd"
                                    d="M13.366 8.234a.8.8 0 010 1.132l-4.8 4.8a.8.8 0 01-1.132 0l-4.8-4.8a.8.8 0 111.132-1.132L7.2 11.67V2.4a.8.8 0 111.6 0v9.269l3.434-3.435a.8.8 0 011.132 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>
                    {searchResult.rows
                        .filter((u) => u.identities.length > 0)
                        .map((u) => (
                            <UserEntry user={u} />
                        ))}
                </div>
                <Pagination
                    currentPage={currentPage}
                    setPage={search}
                    totalNumberOfPages={Math.ceil(searchResult.total / pageLength)}
                />
            </div>
        </AdminPageHeader>
    );
}

function UserEntry(p: { user: User }) {
    if (!p) {
        return <></>;
    }
    const email = getPrimaryEmail(p.user) || "---";
    return (
        <Link key={p.user.id} to={"/admin/users/" + p.user.id} data-analytics='{"button_type":"sidebar_menu"}'>
            <div className="rounded-xl whitespace-nowrap flex space-x-2 py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-kumquat-light group">
                <div className="pr-3 self-center w-1/12">
                    <img className="rounded-full" src={p.user.avatarUrl} alt={p.user.fullName || p.user.name} />
                </div>
                <div className="flex flex-col w-6/12">
                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
                        {p.user.fullName}
                    </div>
                    <div className="text-sm overflow-ellipsis truncate text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                        {email}
                    </div>
                </div>
                <div className="flex w-5/12 self-center">
                    <Tooltip content={dayjs(p.user.creationDate).format("MMM D, YYYY")}>
                        <div className="text-sm w-full text-gray-400 truncate">
                            {dayjs(p.user.creationDate).fromNow()}
                        </div>
                    </Tooltip>
                </div>
            </div>
        </Link>
    );
}

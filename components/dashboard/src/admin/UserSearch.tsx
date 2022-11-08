/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AdminGetListResult, User } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import Pagination from "../Pagination/Pagination";
import { getGitpodService } from "../service/service";
import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";
import UserDetail from "./UserDetail";

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
        <PageWithAdminSubMenu title="Users" subtitle="Search and manage all users.">
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
                            placeholder="Search Users"
                            onKeyDown={(ke) => ke.key === "Enter" && search()}
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
                <div className="px-6 py-3 flex justify-between space-x-2 text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                    <div className="w-1/12"></div>
                    <div className="w-6/12">Name</div>
                    <div className="w-5/12">Created</div>
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
        </PageWithAdminSubMenu>
    );
}

function UserEntry(p: { user: User }) {
    if (!p) {
        return <></>;
    }
    const email = User.getPrimaryEmail(p.user) || "---";
    return (
        <Link key={p.user.id} to={"/admin/users/" + p.user.id} data-analytics='{"button_type":"sidebar_menu"}'>
            <div className="rounded-xl whitespace-nowrap flex space-x-2 py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
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
                    <div className="text-sm w-full text-gray-400 truncate">{dayjs(p.user.creationDate).fromNow()}</div>
                </div>
            </div>
        </Link>
    );
}

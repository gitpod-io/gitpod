/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AdminGetListResult,
    AdminGetWorkspacesQuery,
    ContextURL,
    User,
    WorkspaceAndInstance,
} from "@gitpod/gitpod-protocol";
import {
    matchesInstanceIdOrLegacyWorkspaceIdExactly,
    matchesNewWorkspaceIdExactly,
} from "@gitpod/gitpod-protocol/lib/util/parse-workspace-id";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import Pagination from "../Pagination/Pagination";
import { getGitpodService } from "../service/service";
import { getProjectPath } from "../workspaces/WorkspaceEntry";
import WorkspaceDetail from "./WorkspaceDetail";
import { AdminPageHeader } from "./AdminPageHeader";
import Alert from "../components/Alert";
import { isGitpodIo } from "../utils";
import { SpinnerLoader } from "../components/Loader";
import { WorkspaceStatusIndicator } from "../workspaces/WorkspaceStatusIndicator";
import searchIcon from "../icons/search.svg";
import Tooltip from "../components/Tooltip";

interface Props {
    user?: User;
}

export default function WorkspaceSearchPage() {
    return (
        <AdminPageHeader title="Admin" subtitle="Configure and manage instance settings.">
            <WorkspaceSearch />
        </AdminPageHeader>
    );
}

export function WorkspaceSearch(props: Props) {
    const location = useLocation();
    const [searchResult, setSearchResult] = useState<AdminGetListResult<WorkspaceAndInstance>>({ rows: [], total: 0 });
    const [queryTerm, setQueryTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [currentWorkspace, setCurrentWorkspaceState] = useState<WorkspaceAndInstance | undefined>(undefined);
    const pageLength = 50;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const workspaceId = location.pathname.split("/")[3];
        if (workspaceId) {
            let user = searchResult.rows.find((ws) => ws.workspaceId === workspaceId);
            if (user) {
                setCurrentWorkspaceState(user);
            } else {
                getGitpodService()
                    .server.adminGetWorkspace(workspaceId)
                    .then((ws) => setCurrentWorkspaceState(ws))
                    .catch((e) => console.error(e));
            }
        } else {
            setCurrentWorkspaceState(undefined);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    useEffect(() => {
        if (props.user) {
            search();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.user]);

    if (currentWorkspace) {
        return <WorkspaceDetail workspace={currentWorkspace} />;
    }

    const search = async (page: number = 1) => {
        // Disables empty search on the workspace search page
        if (isGitpodIo() && !props.user && queryTerm.length === 0) {
            return;
        }

        setSearching(true);
        try {
            const query: AdminGetWorkspacesQuery = {
                ownerId: props?.user?.id, // Workspace search in admin user detail
            };
            if (matchesInstanceIdOrLegacyWorkspaceIdExactly(queryTerm)) {
                query.instanceIdOrWorkspaceId = queryTerm;
            } else if (matchesNewWorkspaceIdExactly(queryTerm)) {
                query.workspaceId = queryTerm;
            }
            if (isGitpodIo() && !query.ownerId && !query.instanceIdOrWorkspaceId && !query.workspaceId) {
                return;
            }

            const result = await getGitpodService().server.adminGetWorkspaces({
                limit: pageLength,
                orderBy: "instanceCreationTime",
                offset: (page - 1) * pageLength,
                orderDir: "desc",
                ...query,
            });
            setCurrentPage(page);
            setSearchResult(result);
        } finally {
            setSearching(false);
        }
    };
    return (
        <div className="app-container">
            <div className="mt-3 mb-3 flex">
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
                            placeholder="Search Workspace IDs"
                            onKeyDown={(ke) => ke.key === "Enter" && search()}
                            onChange={(v) => {
                                setQueryTerm(v.target.value.trim());
                            }}
                        />
                    </div>
                </div>
            </div>
            <Alert type={"info"} closable={false} showIcon={true} className="flex rounded p-2 mb-2 w-full">
                Search workspaces using workspace ID.
            </Alert>
            <div className="flex flex-col space-y-2">
                <div className="px-6 py-3 flex justify-between text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                    <div className="w-4/12">Name</div>
                    <div className="w-6/12">Context</div>
                    <div className="w-2/12">Last Started</div>
                </div>
                {searchResult.rows.map((ws) => (
                    <WorkspaceEntry key={ws.workspaceId} ws={ws} />
                ))}
            </div>
            <Pagination
                currentPage={currentPage}
                setPage={search}
                totalNumberOfPages={Math.ceil(searchResult.total / pageLength)}
            />
        </div>
    );
}

function WorkspaceEntry(p: { ws: WorkspaceAndInstance }) {
    return (
        <Link
            key={"ws-" + p.ws.workspaceId}
            to={"/admin/workspaces/" + p.ws.workspaceId}
            data-analytics='{"button_type":"sidebar_menu"}'
        >
            <div className="rounded-xl whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-kumquat-light group">
                <div className="pr-3 self-center w-8">
                    <WorkspaceStatusIndicator instance={WorkspaceAndInstance.toInstance(p.ws)} />
                </div>
                <div className="flex flex-col w-5/12 truncate">
                    <div className="font-medium text-gray-800 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400 truncate">
                        {p.ws.workspaceId}
                    </div>
                    <div className="text-sm overflow-ellipsis truncate text-gray-400 truncate">
                        {getProjectPath(WorkspaceAndInstance.toWorkspace(p.ws))}
                    </div>
                </div>
                <div className="flex flex-col w-5/12 self-center truncate">
                    <div className="text-gray-500 overflow-ellipsis truncate">{p.ws.description}</div>
                    <div className="text-sm text-gray-400 overflow-ellipsis truncate">
                        {ContextURL.getNormalizedURL(p.ws)?.toString()}
                    </div>
                </div>
                <div className="flex w-2/12 self-center">
                    <Tooltip
                        content={dayjs(p.ws.instanceCreationTime || p.ws.workspaceCreationTime).format("MMM D, YYYY")}
                    >
                        <div className="text-sm w-full text-gray-400 truncate">
                            {dayjs(p.ws.instanceCreationTime || p.ws.workspaceCreationTime).fromNow()}
                        </div>
                    </Tooltip>
                </div>
            </div>
        </Link>
    );
}

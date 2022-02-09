/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AdminGetListResult, AdminGetWorkspacesQuery, ContextURL, User, WorkspaceAndInstance } from "@gitpod/gitpod-protocol";
import { matchesInstanceIdOrLegacyWorkspaceIdExactly, matchesNewWorkspaceIdExactly } from "@gitpod/gitpod-protocol/lib/util/parse-workspace-id";
import moment from "moment";
import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Link, Redirect } from "react-router-dom";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { getProject, WorkspaceStatusIndicator } from "../workspaces/WorkspaceEntry";
import { adminMenu } from "./admin-menu";
import WorkspaceDetail from "./WorkspaceDetail";

interface Props {
    user?: User
}

export default function WorkspaceSearchPage() {
    return <PageWithSubMenu subMenu={adminMenu} title="Workspaces" subtitle="Search and manage all workspaces.">
        <WorkspaceSearch />
    </PageWithSubMenu>;
}

export function WorkspaceSearch(props: Props) {
    const location = useLocation();
    const { user } = useContext(UserContext);
    const [searchResult, setSearchResult] = useState<AdminGetListResult<WorkspaceAndInstance>>({ rows: [], total: 0 });
    const [queryTerm, setQueryTerm] = useState('');
    const [searching, setSearching] = useState(false);
    const [currentWorkspace, setCurrentWorkspaceState] = useState<WorkspaceAndInstance|undefined>(undefined);

    useEffect(() => {
        const workspaceId = location.pathname.split('/')[3];
        if (workspaceId) {
            let user = searchResult.rows.find(ws => ws.workspaceId === workspaceId);
            if (user) {
                setCurrentWorkspaceState(user);
            } else {
                getGitpodService().server.adminGetWorkspace(workspaceId).then(
                    ws => setCurrentWorkspaceState(ws)
                ).catch(e => console.error(e));
            }
        } else {
            setCurrentWorkspaceState(undefined);
        }
    }, [location]);

    useEffect(() => {
        if (props.user) {
            search();
        }
    }, [props.user]);

    if (!user || !user?.rolesOrPermissions?.includes('admin')) {
        return <Redirect to="/"/>
    }

    if (currentWorkspace) {
        return <WorkspaceDetail workspace={currentWorkspace}/>;
    }

    const search = async () => {
        setSearching(true);
        try {
            let searchTerm: string | undefined = queryTerm;
            const query: AdminGetWorkspacesQuery = {
                ownerId: props?.user?.id,
            };
            if (matchesInstanceIdOrLegacyWorkspaceIdExactly(searchTerm)) {
                query.instanceIdOrWorkspaceId = searchTerm;
            } else if (matchesNewWorkspaceIdExactly(searchTerm)) {
                query.workspaceId = searchTerm;
            }
            if (query.workspaceId || query.instanceId || query.instanceIdOrWorkspaceId) {
                searchTerm = undefined;
            }

            // const searchTerm = searchTerm;
            const result = await getGitpodService().server.adminGetWorkspaces({
                limit: 100,
                orderBy: 'instanceCreationTime',
                offset: 0,
                orderDir: "desc",
                ...query,
                searchTerm,
            });
            setSearchResult(result);
        } finally {
            setSearching(false);
        }
    }
    return <>
        <div className="pt-8 flex">
            <div className="flex justify-between w-full">
                <div className="flex">
                    <div className="py-4">
                        <svg className={searching ? 'animate-spin' : ''} width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" fill="#A8A29E" />
                        </svg>
                    </div>
                    <input type="search" placeholder="Search Workspaces" onKeyDown={(ke) => ke.key === 'Enter' && search() } onChange={(v) => { setQueryTerm(v.target.value) }} />
                </div>
                <button disabled={searching} onClick={search}>Search</button>
            </div>
        </div>
        <div className="flex flex-col space-y-2">
            <div className="px-6 py-3 flex justify-between text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800 mb-2">
                <div className="w-8"></div>
                <div className="w-5/12">Name</div>
                <div className="w-5/12">Context</div>
                <div className="w-2/12">Last Started</div>
            </div>
            {searchResult.rows.map(ws => <WorkspaceEntry ws={ws} />)}
        </div>
    </>
}

function WorkspaceEntry(p: { ws: WorkspaceAndInstance }) {
    return <Link key={'ws-' + p.ws.workspaceId} to={'/admin/workspaces/' + p.ws.workspaceId} data-analytics='{"button_type":"sidebar_menu"}'>
        <div className="rounded-xl whitespace-nowrap flex py-6 px-6 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
            <div className="pr-3 self-center w-8">
                <WorkspaceStatusIndicator instance={WorkspaceAndInstance.toInstance(p.ws)}/>
            </div>
            <div className="flex flex-col w-5/12 truncate">
                <div className="font-medium text-gray-800 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400 truncate">{p.ws.workspaceId}</div>
                <div className="text-sm overflow-ellipsis truncate text-gray-400 truncate">{getProject(WorkspaceAndInstance.toWorkspace(p.ws))}</div>
            </div>
            <div className="flex flex-col w-5/12 self-center truncate">
                <div className="text-gray-500 overflow-ellipsis truncate">{p.ws.description}</div>
                <div className="text-sm text-gray-400 overflow-ellipsis truncate">{ContextURL.getNormalizedURL(p.ws)?.toString()}</div>
            </div>
            <div className="flex w-2/12 self-center">
                <div className="text-sm w-full text-gray-400 truncate">{moment(p.ws.instanceCreationTime || p.ws.workspaceCreationTime).fromNow()}</div>
            </div>
        </div>
    </Link>;
}

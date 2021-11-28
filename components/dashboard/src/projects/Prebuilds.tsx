/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuildWithStatus, PrebuiltWorkspaceState, Project, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import DropDown, { DropDownEntry } from "../components/DropDown";
import { ItemsList, Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import Spinner from "../icons/Spinner.svg";
import StatusDone from "../icons/StatusDone.svg";
import StatusFailed from "../icons/StatusFailed.svg";
import StatusCanceled from "../icons/StatusCanceled.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";
import { getGitpodService } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { ContextMenuEntry } from "../components/ContextMenu";
import { shortCommitMessage } from "./render-utils";
import { Link } from "react-router-dom";

export default function () {
    const location = useLocation();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    const match = useRouteMatch<{ team: string, resource: string }>("/(t/)?:team/:resource");
    const projectSlug = match?.params?.resource;

    const [project, setProject] = useState<Project | undefined>();

    const [searchFilter, setSearchFilter] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<PrebuiltWorkspaceState | undefined>();

    const [prebuilds, setPrebuilds] = useState<PrebuildWithStatus[]>([]);

    useEffect(() => {
        if (!project) {
            return;
        }
        const registration = getGitpodService().registerClient({
            onPrebuildUpdate: (update: PrebuildWithStatus) => {
                if (update.info.projectId === project.id) {
                    setPrebuilds(prev => [update, ...prev.filter(p => p.info.id !== update.info.id)]);
                }
            }
        });

        (async () => {
            const prebuilds = await getGitpodService().server.findPrebuilds({ projectId: project.id });
            setPrebuilds(prebuilds);
        })();

        return () => {
            registration.dispose();
        }
    }, [project]);

    useEffect(() => {
        if (!teams) {
            return;
        }
        (async () => {
            const projects = (!!team
                ? await getGitpodService().server.getTeamProjects(team.id)
                : await getGitpodService().server.getUserProjects());

        const newProject = projectSlug && projects.find(
            p => p.slug ? p.slug === projectSlug :
            p.name === projectSlug);

            if (newProject) {
                setProject(newProject);
            }
        })();
    }, [teams]);

    const prebuildContextMenu = (p: PrebuildWithStatus) => {
        const isFailed = p.status === "aborted" || p.status === "timeout" || !!p.error;
        const isRunning = p.status === "building";
        const entries: ContextMenuEntry[] = [];
        if (isFailed) {
            entries.push({
                title: `Rerun Prebuild (${p.info.branch})`,
                onClick: () => triggerPrebuild(p.info.branch),
                separator: isRunning
            });
        }
        if (isRunning) {
            entries.push({
                title: "Cancel Prebuild",
                customFontStyle: 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300',
                onClick: () => cancelPrebuild(p.info.id),
            })
        }
        return entries;
    }

    const statusFilterEntries = () => {
        const entries: DropDownEntry[] = [];
        entries.push({
            title: 'All',
            onClick: () => setStatusFilter(undefined)
        });
        entries.push({
            title: 'READY',
            onClick: () => setStatusFilter("available")
        });
        return entries;
    }

    const filter = (p: PrebuildWithStatus) => {
        if (statusFilter && statusFilter !== p.status) {
            return false;
        }
        if (searchFilter && `${p.info.changeTitle} ${p.info.branch}`.toLowerCase().includes(searchFilter.toLowerCase()) === false) {
            return false;
        }
        return true;
    }

    const prebuildSorter = (a: PrebuildWithStatus, b: PrebuildWithStatus) => {
        if (a.info.startedAt < b.info.startedAt) {
            return 1;
        }
        if (a.info.startedAt === b.info.startedAt) {
            return 0;
        }
        return -1;
    }

    const triggerPrebuild = (branchName: string | null) => {
        if (!project) {
            return;
        }
        getGitpodService().server.triggerPrebuild(project.id, branchName);
    }

    const cancelPrebuild = (prebuildId: string) => {
        if (!project) {
            return;
        }
        getGitpodService().server.cancelPrebuild(project.id, prebuildId);
    }

    const formatDate = (date: string | undefined) => {
        return date ? moment(date).fromNow() : "";
    }

    return <>
        <Header title="Prebuilds" subtitle={`View recent prebuilds for active branches.`} />
        <div className="app-container">
            <div className="flex mt-8">
                <div className="flex">
                    <div className="py-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16"><path fill="#A8A29E" d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z" /></svg>
                    </div>
                    <input type="search" placeholder="Search Prebuilds" onChange={e => setSearchFilter(e.target.value)} />
                </div>
                <div className="flex-1" />
                <div className="py-3 pl-3">
                    <DropDown prefix="Prebuild Status: " contextMenuWidth="w-32" entries={statusFilterEntries()} />
                </div>
                {(!!project && prebuilds.length === 0) &&
                    <button onClick={() => triggerPrebuild(null)} className="ml-2">Run Prebuild</button>}
            </div>
            <ItemsList className="mt-2">
                <Item header={true} className="grid grid-cols-3">
                    <ItemField className="my-auto">
                        <span>Prebuild</span>
                    </ItemField>
                    <ItemField className="my-auto">
                        <span>Commit</span>
                    </ItemField>
                    <ItemField className="my-auto">
                        <span>Branch</span>
                    </ItemField>
                </Item>
                {prebuilds.filter(filter).sort(prebuildSorter).map((p, index) => <Item key={`prebuild-${p.info.id}`} className="grid grid-cols-3">
                    <ItemField className="flex items-center my-auto">
                        <Link to={`/${!!team ? 't/'+team.slug : 'projects'}/${projectSlug}/${p.info.id}`} className="cursor-pointer">
                            <div className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase mb-1">
                                <div className="inline-block align-text-bottom mr-2 w-4 h-4">{prebuildStatusIcon(p)}</div>
                                {prebuildStatusLabel(p)}
                            </div>
                            <p>{p.info.startedByAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={p.info.startedByAvatar || ''} alt={p.info.startedBy} />}Triggered {formatDate(p.info.startedAt)}</p>
                        </Link>
                    </ItemField>
                    <ItemField className="flex items-center my-auto">
                        <div className="truncate">
                            <div className="text-base text-gray-500 dark:text-gray-50 font-medium mb-1 truncate" title={shortCommitMessage(p.info.changeTitle)}>{shortCommitMessage(p.info.changeTitle)}</div>
                            <p>{p.info.changeAuthorAvatar && <img className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2" src={p.info.changeAuthorAvatar || ''} alt={p.info.changeAuthor} />}Authored {formatDate(p.info.changeDate)} · {p.info.changeHash?.substring(0, 8)}</p>
                        </div>
                    </ItemField>
                    <ItemField className="flex">
                        <div className="flex space-x-2 truncate">
                            <span className="font-medium text-gray-500 dark:text-gray-50 truncate" title={p.info.branch}>{p.info.branch}</span>
                        </div>
                        <span className="flex-grow" />
                        <ItemFieldContextMenu menuEntries={prebuildContextMenu(p)} />
                    </ItemField>
                </Item>)}
            </ItemsList>
        </div>

    </>;
}

export function prebuildStatusLabel(prebuild?: PrebuildWithStatus) {
    switch (prebuild?.status) {
        case undefined: // Fall through
        case "queued":
            return (<span className="font-medium text-orange-500 uppercase">pending</span>);
        case "building":
            return (<span className="font-medium text-blue-500 uppercase">running</span>);
        case "aborted":
            return (<span className="font-medium text-gray-500 uppercase">canceled</span>);
        case "timeout":
            return (<span className="font-medium text-red-500 uppercase">failed</span>);
        case "available":
            if (prebuild?.error) {
                return (<span className="font-medium text-red-500 uppercase">failed</span>);
            }
            return (<span className="font-medium text-green-500 uppercase">ready</span>);
    }
}

export function prebuildStatusIcon(prebuild?: PrebuildWithStatus) {
    switch (prebuild?.status) {
        case undefined: // Fall through
        case "queued":
            return <img className="h-4 w-4" src={StatusPaused} />;
        case "building":
            return <img className="h-4 w-4" src={StatusRunning} />;
        case "aborted":
            return <img className="h-4 w-4" src={StatusCanceled} />;
        case "timeout":
            return <img className="h-4 w-4" src={StatusFailed} />;
        case "available":
            if (prebuild?.error) {
                return <img className="h-4 w-4" src={StatusFailed} />;
            }
            return <img className="h-4 w-4" src={StatusDone} />;
    }
}

export function PrebuildInstanceStatus(props: { prebuildInstance?: WorkspaceInstance }) {
    let status = <></>;
    let details = <></>;
    switch (props.prebuildInstance?.status.phase) {
        case undefined: // Fall through
        case 'preparing': // Fall through
        case 'pending': // Fall through
        case 'creating': // Fall through
        case 'unknown':
            status = <div className="flex space-x-1 items-center text-yellow-600">
                <img className="h-4 w-4" src={StatusPaused} />
                <span>PENDING</span>
                </div>;
            details = <div className="flex space-x-1 items-center text-gray-400">
                <img className="h-4 w-4 animate-spin" src={Spinner} />
                <span>Preparing prebuild ...</span>
                </div>;
            break;
        case 'initializing': // Fall  through
        case 'running': // Fall through
        case 'interrupted': // Fall through
        case 'stopping':
            status = <div className="flex space-x-1 items-center text-blue-600">
                <img className="h-4 w-4" src={StatusRunning} />
                <span>RUNNING</span>
                </div>;
            details = <div className="flex space-x-1 items-center text-gray-400">
                <img className="h-4 w-4 animate-spin" src={Spinner} />
                <span>Prebuild in progress ...</span>
                </div>;
            break;
        case 'stopped':
            status = <div className="flex space-x-1 items-center text-green-600">
                <img className="h-4 w-4" src={StatusDone} />
                <span>READY</span>
                </div>;
            details = <div className="flex space-x-1 items-center text-gray-400">
                <img className="h-4 w-4 filter-grayscale" src={StatusRunning} />
                <span>{!!props.prebuildInstance?.stoppedTime
                    ? `${Math.round(((new Date(props.prebuildInstance.stoppedTime).getTime()) - (new Date(props.prebuildInstance.creationTime).getTime())) / 1000)}s`
                    : '...'}</span>
                </div>;
            break;
    }
    if (props.prebuildInstance?.status.conditions.stoppedByRequest) {
        status = <div className="flex space-x-1 items-center text-gray-500">
            <img className="h-4 w-4" src={StatusCanceled} />
            <span>CANCELED</span>
        </div>;
        details = <div className="flex space-x-1 items-center text-gray-400">
            <span>Prebuild canceled</span>
        </div>;
    } else if (props.prebuildInstance?.status.conditions.failed || props.prebuildInstance?.status.conditions.headlessTaskFailed) {
        status = <div className="flex space-x-1 items-center text-gitpod-red">
            <img className="h-4 w-4" src={StatusFailed} />
            <span>FAILED</span>
        </div>;
        details = <div className="flex space-x-1 items-center text-gray-400">
            <span>Prebuild failed</span>
        </div>;
    }
    return <div className="flex flex-col space-y-1 justify-center text-sm font-semibold">
        <div>{status}</div>
        <div>{details}</div>
    </div>;
}
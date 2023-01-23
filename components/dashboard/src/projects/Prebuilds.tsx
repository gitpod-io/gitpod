/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { PrebuildWithStatus, PrebuiltWorkspaceState, Project } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import DropDown, { DropDownEntry } from "../components/DropDown";
import { ItemsList, Item, ItemField } from "../components/ItemsList";
import Spinner from "../icons/Spinner.svg";
import StatusDone from "../icons/StatusDone.svg";
import StatusFailed from "../icons/StatusFailed.svg";
import StatusCanceled from "../icons/StatusCanceled.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";
import { getGitpodService } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { shortCommitMessage } from "./render-utils";
import { Link } from "react-router-dom";
import { Disposable } from "vscode-jsonrpc";
import { UserContext } from "../user-context";
import { listAllProjects } from "../service/public-api";
import Tooltip from "../components/Tooltip";

export default function (props: { project?: Project; isAdminDashboard?: boolean }) {
    const location = useLocation();

    const { teams } = useContext(TeamsContext);
    const { user } = useContext(UserContext);
    const team = getCurrentTeam(location, teams);

    const match = useRouteMatch<{ team: string; resource: string }>("/(t/)?:team/:resource");
    const projectSlug = props.isAdminDashboard ? props.project?.slug : match?.params?.resource;

    const [project, setProject] = useState<Project | undefined>();

    const [searchFilter, setSearchFilter] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<PrebuiltWorkspaceState | undefined>();

    const [isLoadingPrebuilds, setIsLoadingPrebuilds] = useState<boolean>(true);
    const [prebuilds, setPrebuilds] = useState<PrebuildWithStatus[]>([]);
    const [isRunningPrebuild, setIsRunningPrebuild] = useState<boolean>(false);

    useEffect(() => {
        let registration: Disposable;
        // Props come from the Admin dashboard and we do not need
        // the variables generated from route or location
        if (props.project) {
            setProject(props.project);
        }
        if (!project) {
            return;
        }
        // This call is excluded in the Admin dashboard
        if (!props.isAdminDashboard) {
            registration = getGitpodService().registerClient({
                onPrebuildUpdate: (update: PrebuildWithStatus) => {
                    if (update.info.projectId === project.id) {
                        setPrebuilds((prev) => [update, ...prev.filter((p) => p.info.id !== update.info.id)]);
                        setIsLoadingPrebuilds(false);
                    }
                },
            });
        }

        (async () => {
            setIsLoadingPrebuilds(true);
            const prebuilds =
                props && props.isAdminDashboard
                    ? await getGitpodService().server.adminFindPrebuilds({ projectId: project.id })
                    : await getGitpodService().server.findPrebuilds({ projectId: project.id });
            setPrebuilds(prebuilds);
            setIsLoadingPrebuilds(false);
        })();

        if (!props.isAdminDashboard) {
            return () => {
                registration.dispose();
            };
        }
    }, [project]);

    useEffect(() => {
        if (!teams) {
            return;
        }
        (async () => {
            let projects: Project[];
            if (!!team) {
                projects = await listAllProjects({ teamId: team.id });
            } else {
                projects = await listAllProjects({ userId: user?.id });
            }
            const newProject =
                projectSlug && projects.find((p) => (p.slug ? p.slug === projectSlug : p.name === projectSlug));

            if (newProject) {
                setProject(newProject);
            }
        })();
    }, [projectSlug, team, teams]);

    useEffect(() => {
        if (prebuilds.length === 0) {
            setIsLoadingPrebuilds(false);
        }
    }, [prebuilds]);

    const statusFilterEntries = () => {
        const entries: DropDownEntry[] = [];
        entries.push({
            title: "All",
            onClick: () => setStatusFilter(undefined),
        });
        entries.push({
            title: "READY",
            onClick: () => setStatusFilter("available"),
        });
        return entries;
    };

    const filter = (p: PrebuildWithStatus) => {
        if (statusFilter && statusFilter !== p.status) {
            return false;
        }
        if (
            searchFilter &&
            `${p.info.changeTitle} ${p.info.branch}`.toLowerCase().includes(searchFilter.toLowerCase()) === false
        ) {
            return false;
        }
        return true;
    };

    const prebuildSorter = (a: PrebuildWithStatus, b: PrebuildWithStatus) => {
        if (a.info.startedAt < b.info.startedAt) {
            return 1;
        }
        if (a.info.startedAt === b.info.startedAt) {
            return 0;
        }
        return -1;
    };

    const runPrebuild = async (branchName: string | null) => {
        if (!project) {
            return;
        }
        setIsRunningPrebuild(true);
        try {
            await getGitpodService().server.triggerPrebuild(project.id, branchName);
        } catch (error) {
            console.error("Could not run prebuild", error);
        } finally {
            setIsRunningPrebuild(false);
        }
    };

    const formatDate = (date: string | undefined) => {
        return date ? dayjs(date).fromNow() : "";
    };

    return (
        <>
            {!props.isAdminDashboard && (
                <Header title="Prebuilds" subtitle={`View recent prebuilds for active branches.`} />
            )}
            <div className={props.isAdminDashboard ? "" : "app-container"}>
                <div className={props.isAdminDashboard ? "flex" : "flex mt-8"}>
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
                            placeholder="Search Prebuilds"
                            onChange={(e) => setSearchFilter(e.target.value)}
                        />
                    </div>
                    <div className="flex-1" />
                    <div className="py-3 pl-3">
                        <DropDown prefix="Prebuild Status: " customClasses="w-32" entries={statusFilterEntries()} />
                    </div>
                    {!props.isAdminDashboard && (
                        <button
                            onClick={() => runPrebuild(null)}
                            disabled={isRunningPrebuild}
                            className="ml-2 flex items-center space-x-2"
                        >
                            {isRunningPrebuild && (
                                <img alt="" className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                            )}
                            <span>Run Prebuild</span>
                        </button>
                    )}
                </div>
                <ItemsList className="mt-2">
                    <Item header={true}>
                        <ItemField className="my-auto md:w-3/12 xl:w-4/12">
                            <span>Prebuild</span>
                        </ItemField>
                        <ItemField className="my-auto w-5/12">
                            <span>Commit</span>
                        </ItemField>
                        <ItemField className="my-auto w-3/12">
                            <span>Branch</span>
                        </ItemField>
                    </Item>
                    {isLoadingPrebuilds && (
                        <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm pt-16 pb-40">
                            <img alt="" className="h-4 w-4 animate-spin" src={Spinner} />
                            <span>Fetching prebuilds...</span>
                        </div>
                    )}
                    {prebuilds
                        .filter(filter)
                        .sort(prebuildSorter)
                        .map((p, index) => (
                            <Link
                                to={`/${!!team ? "t/" + team.slug : "projects"}/${projectSlug}/${p.info.id}`}
                                className="cursor-pointer"
                            >
                                <Item key={`prebuild-${p.info.id}`}>
                                    <ItemField
                                        className={`flex items-center my-auto md:w-3/12 xl:w-4/12 ${
                                            props.isAdminDashboard ? "pointer-events-none" : ""
                                        }`}
                                    >
                                        <div>
                                            <div
                                                className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase mb-1"
                                                title={getPrebuildStatusDescription(p)}
                                            >
                                                <div className="inline-block align-text-bottom mr-2 w-4 h-4">
                                                    {prebuildStatusIcon(p)}
                                                </div>
                                                {prebuildStatusLabel(p)}
                                            </div>
                                            <p>
                                                {p.info.startedByAvatar && (
                                                    <img
                                                        className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2"
                                                        src={p.info.startedByAvatar || ""}
                                                        alt={p.info.startedBy}
                                                    />
                                                )}
                                                <Tooltip
                                                    className="w-fit"
                                                    content={dayjs(p.info.startedAt).format("MMM D, YYYY")}
                                                >
                                                    Triggered {formatDate(p.info.startedAt)}
                                                </Tooltip>
                                            </p>
                                        </div>
                                    </ItemField>
                                    <ItemField className="flex items-center my-auto w-5/12">
                                        <div className="truncate">
                                            <a href={p.info.changeUrl} className="cursor-pointer">
                                                <div
                                                    className="text-base text-gray-500 dark:text-gray-50 font-medium mb-1 truncate"
                                                    title={shortCommitMessage(p.info.changeTitle)}
                                                >
                                                    {shortCommitMessage(p.info.changeTitle)}
                                                </div>
                                            </a>
                                            <p>
                                                {p.info.changeAuthorAvatar && (
                                                    <img
                                                        className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2 overflow-hidden"
                                                        src={p.info.changeAuthorAvatar || ""}
                                                        alt={p.info.changeAuthor}
                                                    />
                                                )}
                                                <Tooltip
                                                    className="w-fit"
                                                    content={dayjs(p.info.changeDate).format("MMM D, YYYY")}
                                                >
                                                    Authored {formatDate(p.info.changeDate)} ·{" "}
                                                    {p.info.changeHash?.substring(0, 8)}
                                                </Tooltip>
                                                Authored {formatDate(p.info.changeDate)} ·{" "}
                                                <span className="font-mono">{p.info.changeHash?.substring(0, 8)}</span>
                                            </p>
                                        </div>
                                    </ItemField>
                                    <ItemField className="flex w-3/12">
                                        <div className="truncate">
                                            <a href={p.info.changeUrl} className="cursor-pointer">
                                                <div className="flex space-x-2 truncate">
                                                    <span
                                                        className="font-medium text-gray-500 dark:text-gray-50 truncate font-mono"
                                                        title={p.info.branch}
                                                    >
                                                        {p.info.branch}
                                                    </span>
                                                </div>
                                            </a>
                                        </div>
                                        <span className="flex-grow" />
                                    </ItemField>
                                </Item>
                            </Link>
                        ))}
                </ItemsList>
                {!isLoadingPrebuilds && prebuilds.length === 0 && (
                    <div className="p-3 text-gray-400 rounded-xl text-sm text-center">No prebuilds found.</div>
                )}
            </div>
        </>
    );
}

export function prebuildStatusLabel(prebuild?: PrebuildWithStatus) {
    switch (prebuild?.status) {
        case undefined: // Fall through
        case "queued":
            return <span className="font-medium text-orange-500 uppercase">pending</span>;
        case "building":
            return <span className="font-medium text-blue-500 uppercase">running</span>;
        case "aborted":
            return <span className="font-medium text-gray-500 uppercase">canceled</span>;
        case "failed":
            return <span className="font-medium text-red-500 uppercase">system error</span>;
        case "timeout":
            return <span className="font-medium text-red-500 uppercase">timed out</span>;
        case "available":
            if (prebuild?.error) {
                return <span className="font-medium text-red-500 uppercase">failed</span>;
            }
            return <span className="font-medium text-green-500 uppercase">ready</span>;
    }
}

export function prebuildStatusIcon(prebuild?: PrebuildWithStatus) {
    switch (prebuild?.status) {
        case undefined: // Fall through
        case "queued":
            return <img alt="" className="h-4 w-4" src={StatusPaused} />;
        case "building":
            return <img alt="" className="h-4 w-4" src={StatusRunning} />;
        case "aborted":
            return <img alt="" className="h-4 w-4" src={StatusCanceled} />;
        case "failed":
            return <img alt="" className="h-4 w-4" src={StatusFailed} />;
        case "timeout":
            return <img alt="" className="h-4 w-4" src={StatusFailed} />;
        case "available":
            if (prebuild?.error) {
                return <img alt="" className="h-4 w-4" src={StatusFailed} />;
            }
            return <img alt="" className="h-4 w-4" src={StatusDone} />;
    }
}

function getPrebuildStatusDescription(prebuild: PrebuildWithStatus): string {
    switch (prebuild.status) {
        case "queued":
            return `Prebuild is queued and will be processed when there is execution capacity.`;
        case "building":
            return `Prebuild is currently in progress.`;
        case "aborted":
            return `Prebuild has been cancelled. Either a newer commit was pushed to the same branch, a user cancelled it manually, or the prebuild rate limit has been exceeded. ${prebuild.error}`;
        case "failed":
            return `Prebuild failed for system reasons. Please contact support. ${prebuild.error}`;
        case "timeout":
            return `Prebuild timed out. Either the image, or the prebuild tasks took too long. ${prebuild.error}`;
        case "available":
            if (prebuild.error) {
                return `The tasks executed in the prebuild returned a non-zero exit code. ${prebuild.error}`;
            }
            return `Prebuild completed successfully.`;
        default:
            return `Unknown prebuild status.`;
    }
}

export function PrebuildStatus(props: { prebuild: PrebuildWithStatus }) {
    const prebuild = props.prebuild;

    return (
        <div className="flex flex-col space-y-1 justify-center text-sm font-semibold">
            <div>
                <div className="flex space-x-1 items-center">
                    {prebuildStatusIcon(prebuild)}
                    {prebuildStatusLabel(prebuild)}
                </div>
            </div>
            <div className="flex space-x-1 items-center text-gray-400">
                <span className="text-left">{getPrebuildStatusDescription(prebuild)}</span>
            </div>
        </div>
    );
}

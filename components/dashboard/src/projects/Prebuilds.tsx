/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { Project } from "@gitpod/gitpod-protocol";
import { useEffect, useState } from "react";
import Header from "../components/Header";
import DropDown, { DropDownEntry } from "../components/DropDown";
import { ItemsList, Item, ItemField } from "../components/ItemsList";
import Spinner from "../icons/Spinner.svg";
import StatusDone from "../icons/StatusDone.svg";
import StatusFailed from "../icons/StatusFailed.svg";
import StatusCanceled from "../icons/StatusCanceled.svg";
import StatusPaused from "../icons/StatusPaused.svg";
import StatusRunning from "../icons/StatusRunning.svg";
import { shortCommitMessage } from "./render-utils";
import { Link, Redirect } from "react-router-dom";
import { useCurrentProject } from "./project-context";
import { getProjectTabs } from "./projects.routes";
import search from "../icons/search.svg";
import Tooltip from "../components/Tooltip";
import { prebuildClient, watchPrebuild } from "../service/public-api";
import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { Button } from "@podkit/buttons/Button";

export default function PrebuildsPage(props: { project?: Project; isAdminDashboard?: boolean }) {
    const currentProject = useCurrentProject();
    const project = props.project || currentProject.project;

    const [searchFilter, setSearchFilter] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<PrebuildPhase_Phase | undefined>();

    const [isLoadingPrebuilds, setIsLoadingPrebuilds] = useState<boolean>(true);
    const [prebuilds, setPrebuilds] = useState<Prebuild[]>([]);
    const [isRunningPrebuild, setIsRunningPrebuild] = useState<boolean>(false);

    useEffect(() => {
        if (!project) {
            return;
        }

        (async () => {
            setIsLoadingPrebuilds(true);
            const response = await prebuildClient.listPrebuilds({
                configurationId: project.id,
            });
            setPrebuilds(response.prebuilds);
            setIsLoadingPrebuilds(false);
        })();

        // This call is excluded in the Admin dashboard
        if (!props.isAdminDashboard) {
            const toCancelWatch = watchPrebuild(
                {
                    scope: {
                        case: "configurationId",
                        value: project.id,
                    },
                },
                (prebuild) => {
                    setPrebuilds((prev) => [prebuild, ...prev.filter((p) => p.id !== prebuild.id)]);
                    setIsLoadingPrebuilds(false);
                },
            );
            return () => toCancelWatch.dispose();
        }
    }, [project, props]);

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
            onClick: () => setStatusFilter(PrebuildPhase_Phase.AVAILABLE),
        });
        return entries;
    };

    const filter = (p: Prebuild) => {
        if (statusFilter && statusFilter !== p.status?.phase?.name) {
            return false;
        }
        if (
            searchFilter &&
            `${p.commit?.message} ${p.ref}`.toLowerCase().includes(searchFilter.toLowerCase()) === false
        ) {
            return false;
        }
        return true;
    };

    const prebuildSorter = (a: Prebuild, b: Prebuild) => {
        const aDate = a.status?.startTime?.toDate();
        const bDate = b.status?.startTime?.toDate();
        if (!aDate) {
            return 1;
        }
        if (!bDate) {
            return -1;
        }
        if (aDate < bDate) {
            return 1;
        }
        if (aDate === bDate) {
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
            await prebuildClient.startPrebuild({
                configurationId: project.id,
                gitRef: branchName || undefined,
            });
        } catch (error) {
            console.error("Could not run prebuild", error);
        } finally {
            setIsRunningPrebuild(false);
        }
    };

    const formatDate = (date: Date | undefined) => {
        return date ? dayjs(date).fromNow() : "";
    };

    if (!currentProject.loading && !project) {
        return <Redirect to="/projects" />;
    }

    return (
        <>
            {!props.isAdminDashboard && (
                <Header
                    title={project?.name || "Unknown project"}
                    subtitle={`View recent prebuilds for active branches.`}
                    tabs={getProjectTabs(project)}
                />
            )}
            <div className={props.isAdminDashboard ? "" : "app-container"}>
                <div className={props.isAdminDashboard ? "flex" : "flex pt-2"}>
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
                            placeholder="Search Prebuilds"
                            onChange={(e) => setSearchFilter(e.target.value)}
                        />
                    </div>
                    <div className="flex-1" />
                    <div className="py-2 pl-3">
                        <DropDown prefix="Prebuild Status: " customClasses="w-32" entries={statusFilterEntries()} />
                    </div>
                    {!props.isAdminDashboard && (
                        <Button
                            onClick={() => runPrebuild(null)}
                            disabled={isRunningPrebuild}
                            className="ml-2 flex items-center space-x-2"
                        >
                            {isRunningPrebuild && (
                                <img alt="" className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                            )}
                            <span>Run Prebuild</span>
                        </Button>
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
                            <Link to={`/projects/${project?.id ?? ""}/${p.id}`} className="cursor-pointer">
                                <Item key={`prebuild-${p.id}`}>
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
                                                <Tooltip
                                                    content={dayjs(p.status?.startTime?.toDate()).format("MMM D, YYYY")}
                                                >
                                                    Triggered {formatDate(p.status?.startTime?.toDate())}
                                                </Tooltip>
                                            </p>
                                        </div>
                                    </ItemField>
                                    <ItemField className="flex items-center my-auto w-5/12">
                                        <div className="truncate">
                                            <a href={p?.contextUrl} className="cursor-pointer">
                                                <div
                                                    className="text-base text-gray-500 dark:text-gray-50 font-medium mb-1 truncate"
                                                    title={shortCommitMessage(p.commit?.message || "")}
                                                >
                                                    {shortCommitMessage(p.commit?.message || "")}
                                                </div>
                                            </a>
                                            <p>
                                                {p.commit?.author && (
                                                    <img
                                                        className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2 overflow-hidden"
                                                        src={p.commit.author.avatarUrl || ""}
                                                        alt={p.commit.author.name || ""}
                                                    />
                                                )}
                                                Authored {formatDate(p.commit?.authorDate?.toDate())} ·{" "}
                                                {p.commit?.sha?.substring(0, 8)}
                                            </p>
                                        </div>
                                    </ItemField>
                                    <ItemField className="flex w-3/12">
                                        <div className="truncate">
                                            <a href={p.contextUrl} className="cursor-pointer">
                                                <div className="flex space-x-2 truncate">
                                                    <span
                                                        className="font-medium text-gray-500 dark:text-gray-50 truncate"
                                                        title={p.ref}
                                                    >
                                                        {p.ref}
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

export function prebuildStatusLabel(prebuild?: Prebuild) {
    switch (prebuild?.status?.phase?.name) {
        case PrebuildPhase_Phase.UNSPECIFIED: // Fall through
        case PrebuildPhase_Phase.QUEUED:
            return <span className="font-medium text-orange-500 uppercase">pending</span>;
        case PrebuildPhase_Phase.BUILDING:
            return <span className="font-medium text-blue-500 uppercase">running</span>;
        case PrebuildPhase_Phase.ABORTED:
            return <span className="font-medium text-gray-500 uppercase">canceled</span>;
        case PrebuildPhase_Phase.FAILED:
            return <span className="font-medium text-red-500 uppercase">system error</span>;
        case PrebuildPhase_Phase.TIMEOUT:
            return <span className="font-medium text-red-500 uppercase">timed out</span>;
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild?.status?.message) {
                return <span className="font-medium text-red-500 uppercase">failed</span>;
            }
            return <span className="font-medium text-green-500 uppercase">ready</span>;
    }
}

export function prebuildStatusIcon(prebuild?: Prebuild) {
    switch (prebuild?.status?.phase?.name) {
        case PrebuildPhase_Phase.UNSPECIFIED: // Fall through
        case PrebuildPhase_Phase.QUEUED:
            return <img alt="" className="h-4 w-4" src={StatusPaused} />;
        case PrebuildPhase_Phase.BUILDING:
            return <img alt="" className="h-4 w-4" src={StatusRunning} />;
        case PrebuildPhase_Phase.ABORTED:
            return <img alt="" className="h-4 w-4" src={StatusCanceled} />;
        case PrebuildPhase_Phase.FAILED:
            return <img alt="" className="h-4 w-4" src={StatusFailed} />;
        case PrebuildPhase_Phase.TIMEOUT:
            return <img alt="" className="h-4 w-4" src={StatusFailed} />;
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild?.status?.message) {
                return <img alt="" className="h-4 w-4" src={StatusFailed} />;
            }
            return <img alt="" className="h-4 w-4" src={StatusDone} />;
    }
}

function getPrebuildStatusDescription(prebuild: Prebuild): string {
    switch (prebuild.status?.phase?.name) {
        case PrebuildPhase_Phase.QUEUED:
            return `Prebuild is queued and will be processed when there is execution capacity.`;
        case PrebuildPhase_Phase.BUILDING:
            return `Prebuild is currently in progress.`;
        case PrebuildPhase_Phase.ABORTED:
            return `Prebuild has been cancelled. Either a newer commit was pushed to the same branch, a user cancelled it manually, or the prebuild rate limit has been exceeded. ${
                prebuild.status?.message || ""
            }`;
        case PrebuildPhase_Phase.FAILED:
            return `Prebuild failed for system reasons. Please contact support. ${prebuild.status?.message || ""}`;
        case PrebuildPhase_Phase.TIMEOUT:
            return `Prebuild timed out. Either the image, or the prebuild tasks took too long. ${
                prebuild.status?.message || ""
            }`;
        case PrebuildPhase_Phase.AVAILABLE:
            if (prebuild.status?.message) {
                return `The tasks executed in the prebuild returned a non-zero exit code. ${prebuild.status.message}`;
            }
            return `Prebuild completed successfully.`;
        default:
            return `Unknown prebuild status.`;
    }
}

export function PrebuildStatus(props: { prebuild: Prebuild }) {
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

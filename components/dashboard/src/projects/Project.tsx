/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { Redirect, useHistory } from "react-router";
import Alert from "../components/Alert";
import Header from "../components/Header";
import { Item, ItemField, ItemFieldContextMenu, ItemsList } from "../components/ItemsList";
import { Subheading } from "../components/typography/headings";
import NoAccess from "../icons/NoAccess.svg";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { openAuthorizeWindow } from "../provider-utils";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { prebuildStatusIcon, prebuildStatusLabel } from "./Prebuilds";
import { useCurrentProject } from "./project-context";
import { getProjectTabs } from "./projects.routes";
import { shortCommitMessage, toRemoteURL } from "./render-utils";
import search from "../icons/search.svg";
import Tooltip from "../components/Tooltip";
import { prebuildClient } from "../service/public-api";
import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { Button } from "@podkit/buttons/Button";

export default function ProjectsPage() {
    const history = useHistory();
    const { project, loading } = useCurrentProject();

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
    const [branches, setBranches] = useState<Project.BranchDetails[]>([]);
    const [isConsideredInactive, setIsConsideredInactive] = useState<boolean>(false);
    const [isResuming, setIsResuming] = useState<boolean>(false);
    const [prebuilds, setPrebuilds] = useState<Map<string, Prebuild | undefined>>(new Map());
    const [prebuildLoaders, setPrebuildLoaders] = useState<Set<string>>(new Set());

    const [searchFilter, setSearchFilter] = useState<string | undefined>();

    const [showAuthBanner, setShowAuthBanner] = useState<{ host: string } | undefined>(undefined);

    useEffect(() => {
        // project changed, reset state
        setBranches([]);
        setIsLoading(false);
        setIsLoadingBranches(false);
        setIsConsideredInactive(false);
        setIsResuming(false);
        setPrebuilds(new Map());
        setPrebuildLoaders(new Set());
        setSearchFilter(undefined);
        setShowAuthBanner(undefined);
    }, [project]);

    const updateBranches = useCallback(async () => {
        if (!project) {
            return;
        }
        setIsLoadingBranches(true);
        try {
            const details = await getGitpodService().server.getProjectOverview(project.id);
            if (details) {
                // default branch on top of the rest
                const branches = details.branches.sort((a, b) => (b.isDefault as any) - (a.isDefault as any)) || [];
                setBranches(branches);
                setIsConsideredInactive(!!details.isConsideredInactive);
            }
        } finally {
            setIsLoadingBranches(false);
        }
    }, [project]);

    useEffect(() => {
        updateBranches().catch((error) => {
            if (project && error && error.code === ErrorCodes.NOT_AUTHENTICATED) {
                setShowAuthBanner({ host: new URL(project.cloneUrl).hostname });
            } else {
                console.error("Getting branches failed", error);
            }
        });
    }, [project, updateBranches]);

    const tryAuthorize = async (host: string, onSuccess: () => void) => {
        try {
            await openAuthorizeWindow({
                host,
                onSuccess,
                onError: (error) => {
                    console.log(error);
                },
            });
        } catch (error) {
            console.log(error);
        }
    };

    const onConfirmShowAuthModal = async (host: string) => {
        setShowAuthBanner(undefined);
        await tryAuthorize(host, async () => {
            // update remote session
            await getGitpodService().reconnect();

            // retry fetching branches
            updateBranches().catch((e) => console.log(e));
        });
    };

    const matchingPrebuild = (branch: Project.BranchDetails) => {
        const matchingPrebuild = prebuilds.get(branch.name);
        if (!matchingPrebuild) {
            // do not await here.
            loadPrebuild(branch);
        }
        return matchingPrebuild;
    };

    const loadPrebuild = async (branch: Project.BranchDetails) => {
        if (prebuildLoaders.has(branch.name) || prebuilds.has(branch.name)) {
            // `prebuilds.has(branch.name)` will be true even if loading finished with no prebuild found.
            // TODO(at): this need to be revised once prebuild events are integrated
            return;
        }
        if (!project) {
            return;
        }
        prebuildLoaders.add(branch.name);
        const response = await prebuildClient.listPrebuilds({
            configurationId: project.id,
            gitRef: branch.name,
            pagination: {
                pageSize: 1,
            },
        });
        setPrebuilds((prev) => new Map(prev).set(branch.name, response.prebuilds[0]));
        prebuildLoaders.delete(branch.name);
    };

    const filter = (branch: Project.BranchDetails) => {
        if (
            searchFilter &&
            `${branch.changeTitle} ${branch.name}`.toLowerCase().includes(searchFilter.toLowerCase()) === false
        ) {
            return false;
        }
        return true;
    };

    const triggerPrebuild = async (branch: Project.BranchDetails) => {
        if (!project) {
            return;
        }
        try {
            setIsLoading(true);
            const prebuildResult = await prebuildClient.startPrebuild({
                configurationId: project.id,
                gitRef: branch.name || undefined,
            });
            history.push(`/projects/${project.id}/${prebuildResult.prebuildId}`);
        } finally {
            setIsLoading(false);
        }
    };

    const cancelPrebuild = async (prebuildId: string) => {
        if (!project) {
            return;
        }
        try {
            await prebuildClient.cancelPrebuild({ prebuildId });
        } catch (e) {
            console.error("Could not cancel prebuild", e);
        }
    };

    const formatDate = (date: string | undefined) => {
        return date ? dayjs(date).fromNow() : "";
    };

    const resumePrebuilds = async () => {
        if (!project) {
            return;
        }
        try {
            setIsResuming(true);
            const response = await prebuildClient.startPrebuild({ configurationId: project.id });
            setIsConsideredInactive(false);
            history.push(`/projects/${project.id}/${response.prebuildId}`);
        } catch (error) {
            console.error(error);
        } finally {
            setIsResuming(false);
        }
    };

    if (!loading && !project) {
        return <Redirect to="/projects" />;
    }

    return (
        <>
            <Header
                title={project?.name || "Loading..."}
                subtitle={
                    <Subheading tracking="wide">
                        View recent active branches for{" "}
                        <a target="_blank" rel="noreferrer noopener" className="gp-link" href={project?.cloneUrl!}>
                            {toRemoteURL(project?.cloneUrl || "")}
                        </a>
                        .
                    </Subheading>
                }
                tabs={getProjectTabs(project)}
            />
            <div className="app-container">
                {showAuthBanner ? (
                    <div className="mt-8 rounded-xl text-gray-500 bg-gray-50 dark:bg-gray-800 flex-col">
                        <div className="p-8 text-center">
                            <img src={NoAccess} alt="" title="No Access" className="m-auto mb-4" />
                            <div className="text-center text-gray-600 dark:text-gray-50 pb-3 font-bold">No Access</div>
                            <div className="text-center dark:text-gray-400 pb-3">
                                Authorize {showAuthBanner.host} <br />
                                to access branch information.
                            </div>
                            <Button className={`mr-2 py-2`} onClick={() => onConfirmShowAuthModal(showAuthBanner.host)}>
                                Authorize Provider
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="pt-2 flex">
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
                                    placeholder="Search Active Branches"
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                />
                            </div>
                            <div className="flex-1" />
                            {isLoading && (
                                <div className="flex justify-center w-1/12">
                                    <Spinner className="h-4 w-4 animate-spin" />
                                </div>
                            )}
                        </div>
                        <ItemsList className="mt-2">
                            <Item header={true} className="grid grid-cols-3">
                                <ItemField className="my-auto">
                                    <span>Branch</span>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <span>Commit</span>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <span>Prebuild</span>
                                </ItemField>
                            </Item>
                            {isConsideredInactive && (
                                <Alert
                                    type={"warning"}
                                    onClose={() => {}}
                                    showIcon={true}
                                    className="flex rounded mb-2 w-full"
                                >
                                    To reduce resource usage, prebuilds are automatically paused when not used for a
                                    workspace after 7 days.{" "}
                                    {isResuming && (
                                        <span>
                                            Resuming <Spinner className="h-4 w-4 animate-spin" />
                                        </span>
                                    )}
                                    {!isResuming && (
                                        <Button variant="link" onClick={() => resumePrebuilds()}>
                                            Resume prebuilds
                                        </Button>
                                    )}
                                </Alert>
                            )}
                            {isLoadingBranches && (
                                <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm pt-16 pb-40">
                                    <Spinner className="h-4 w-4 animate-spin" />
                                    <span>Fetching repository branches...</span>
                                </div>
                            )}
                            {project &&
                                branches
                                    .filter(filter)
                                    .slice(0, 10)
                                    .map((branch, index) => {
                                        let prebuild = matchingPrebuild(branch); // this might lazily trigger fetching of prebuild details
                                        if (prebuild && prebuild.commit?.sha !== branch.changeHash) {
                                            prebuild = undefined;
                                        }
                                        const avatar = branch.changeAuthorAvatar && (
                                            <img
                                                className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2 overflow-hidden"
                                                src={branch.changeAuthorAvatar || ""}
                                                alt={branch.changeAuthor}
                                            />
                                        );
                                        const statusIcon = prebuild && prebuildStatusIcon(prebuild);
                                        const status = prebuild && prebuildStatusLabel(prebuild);

                                        return (
                                            <Item
                                                key={`branch-${index}-${branch.name}`}
                                                className="grid grid-cols-3 group"
                                            >
                                                <ItemField className="flex items-center my-auto">
                                                    <div>
                                                        <a href={branch.url}>
                                                            <div className="text-base text-gray-600 hover:text-gray-800 dark:text-gray-50 dark:hover:text-gray-200 font-medium mb-1">
                                                                {branch.name}
                                                                {branch.isDefault && (
                                                                    <span className="ml-2 self-center rounded-xl py-0.5 px-2 text-sm bg-blue-50 text-blue-40 dark:bg-blue-500 dark:text-blue-100">
                                                                        DEFAULT
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </a>
                                                    </div>
                                                </ItemField>
                                                <ItemField className="flex items-center my-auto">
                                                    <div className="truncate">
                                                        <div className="text-base text-gray-500 dark:text-gray-50 font-medium mb-1 truncate">
                                                            {shortCommitMessage(branch.changeTitle)}
                                                        </div>
                                                        {branch.changeDate ? (
                                                            <Tooltip
                                                                content={dayjs(branch.changeDate).format("MMM D, YYYY")}
                                                            >
                                                                <p>
                                                                    {avatar}Authored {formatDate(branch.changeDate)} ·{" "}
                                                                    {branch.changeHash?.substring(0, 8)}
                                                                </p>
                                                            </Tooltip>
                                                        ) : (
                                                            <p>
                                                                {avatar}Authored {formatDate(branch.changeDate)} ·{" "}
                                                                {branch.changeHash?.substring(0, 8)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </ItemField>
                                                <ItemField className="flex items-center my-auto">
                                                    <a
                                                        className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase mb-1 cursor-pointer"
                                                        href={prebuild ? `/projects/${project.id}/${prebuild.id}` : ""}
                                                    >
                                                        {prebuild ? (
                                                            <>
                                                                <div className="inline-block align-text-bottom mr-2 w-4 h-4">
                                                                    {statusIcon}
                                                                </div>
                                                                {status}
                                                            </>
                                                        ) : (
                                                            <span> </span>
                                                        )}
                                                    </a>
                                                    <span className="flex-grow" />
                                                    <a href={gitpodHostUrl.withContext(`${branch.url}`).toString()}>
                                                        <Button
                                                            className={`mr-2 py-2 opacity-0 group-hover:opacity-100`}
                                                        >
                                                            New Workspace
                                                        </Button>
                                                    </a>
                                                    <ItemFieldContextMenu
                                                        className="py-0.5"
                                                        menuEntries={[
                                                            prebuild?.status?.phase?.name ===
                                                                PrebuildPhase_Phase.QUEUED ||
                                                            prebuild?.status?.phase?.name ===
                                                                PrebuildPhase_Phase.BUILDING
                                                                ? {
                                                                      title: "Cancel Prebuild",
                                                                      customFontStyle:
                                                                          "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                                                      onClick: () =>
                                                                          prebuild && cancelPrebuild(prebuild.id),
                                                                  }
                                                                : {
                                                                      title: `${prebuild ? "Rerun" : "Run"} Prebuild (${
                                                                          branch.name
                                                                      })`,
                                                                      onClick: () => triggerPrebuild(branch),
                                                                  },
                                                        ]}
                                                    />
                                                </ItemField>
                                            </Item>
                                        );
                                    })}
                        </ItemsList>
                    </>
                )}
            </div>
            <div></div>
        </>
    );
}

/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { PrebuildWithStatus, Project } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import { ItemsList, Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { prebuildStatusIcon, prebuildStatusLabel } from "./Prebuilds";
import { shortCommitMessage, toRemoteURL } from "./render-utils";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import NoAccess from "../icons/NoAccess.svg";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { openAuthorizeWindow } from "../provider-utils";
import Alert from "../components/Alert";

export default function () {
    const location = useLocation();
    const history = useHistory();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    const match = useRouteMatch<{ team: string; resource: string }>("/(t/)?:team/:resource");
    const projectSlug = match?.params?.resource;

    const [project, setProject] = useState<Project | undefined>();

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLoadingBranches, setIsLoadingBranches] = useState<boolean>(false);
    const [branches, setBranches] = useState<Project.BranchDetails[]>([]);
    const [isConsideredInactive, setIsConsideredInactive] = useState<boolean>(false);
    const [isResuming, setIsResuming] = useState<boolean>(false);
    const [prebuilds, setPrebuilds] = useState<Map<string, PrebuildWithStatus | undefined>>(new Map());
    const [prebuildLoaders] = useState<Set<string>>(new Set());

    const [searchFilter, setSearchFilter] = useState<string | undefined>();

    const [showAuthBanner, setShowAuthBanner] = useState<{ host: string } | undefined>(undefined);

    useEffect(() => {
        updateProject();
    }, [teams]);

    useEffect(() => {
        if (!project) {
            return;
        }
        (async () => {
            try {
                await updateBranches();
            } catch (error) {
                if (error && error.code === ErrorCodes.NOT_AUTHENTICATED) {
                    setShowAuthBanner({ host: new URL(project.cloneUrl).hostname });
                } else {
                    console.error("Getting branches failed", error);
                }
            }
        })();
    }, [project]);

    const updateProject = async () => {
        if (!teams || !projectSlug) {
            return;
        }
        const projects = !!team
            ? await getGitpodService().server.getTeamProjects(team.id)
            : await getGitpodService().server.getUserProjects();

        // Find project matching with slug, otherwise with name
        const project = projectSlug && projects.find((p) => (p.slug ? p.slug === projectSlug : p.name === projectSlug));

        if (!project) {
            return;
        }

        setProject(project);
    };

    const updateBranches = async () => {
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
    };

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
        const branchPrebuilds = await getGitpodService().server.findPrebuilds({
            projectId: project.id,
            branch: branch.name,
            latest: true,
        });
        setPrebuilds((prev) => new Map(prev).set(branch.name, branchPrebuilds[0]));
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
            const prebuildResult = await getGitpodService().server.triggerPrebuild(project.id, branch.name);
            history.push(`/${!!team ? "t/" + team.slug : "projects"}/${projectSlug}/${prebuildResult.prebuildId}`);
        } finally {
            setIsLoading(false);
        }
    };

    const cancelPrebuild = (prebuildId: string) => {
        if (!project) {
            return;
        }
        getGitpodService().server.cancelPrebuild(project.id, prebuildId);
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
            const response = await getGitpodService().server.triggerPrebuild(project.id, null);
            setIsConsideredInactive(false);
            history.push(`/${!!team ? "t/" + team.slug : "projects"}/${projectSlug}/${response.prebuildId}`);
        } catch (error) {
            console.error(error);
        } finally {
            setIsResuming(false);
        }
    };

    return (
        <>
            <Header
                title="Branches"
                subtitle={
                    <h2 className="tracking-wide">
                        View recent active branches for{" "}
                        <a className="gp-link" href={project?.cloneUrl!}>
                            {toRemoteURL(project?.cloneUrl || "")}
                        </a>
                        .
                    </h2>
                }
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
                            <button
                                className={`primary mr-2 py-2`}
                                onClick={() => onConfirmShowAuthModal(showAuthBanner.host)}
                            >
                                Authorize Provider
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex mt-8">
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
                                        <>
                                            Resuming <Spinner className="h-4 w-4 animate-spin" />
                                        </>
                                    )}
                                    {!isResuming && (
                                        <a
                                            href="javascript:void(0)"
                                            className="gp-link hover:text-gray-600"
                                            onClick={() => resumePrebuilds()}
                                        >
                                            Resume prebuilds
                                        </a>
                                    )}
                                </Alert>
                            )}
                            {isLoadingBranches && (
                                <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm pt-16 pb-40">
                                    <Spinner className="h-4 w-4 animate-spin" />
                                    <span>Fetching repository branches...</span>
                                </div>
                            )}
                            {branches
                                .filter(filter)
                                .slice(0, 10)
                                .map((branch, index) => {
                                    let prebuild = matchingPrebuild(branch); // this might lazily trigger fetching of prebuild details
                                    if (prebuild && prebuild.info.changeHash !== branch.changeHash) {
                                        prebuild = undefined;
                                    }
                                    const avatar = branch.changeAuthorAvatar && (
                                        <img
                                            className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2 overflow-hidden"
                                            src={branch.changeAuthorAvatar || ""}
                                            alt={branch.changeAuthor}
                                        />
                                    );
                                    const statusIcon = prebuildStatusIcon(prebuild);
                                    const status = prebuildStatusLabel(prebuild);

                                    return (
                                        <Item key={`branch-${index}-${branch.name}`} className="grid grid-cols-3 group">
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
                                                    <p>
                                                        {avatar}Authored {formatDate(branch.changeDate)} ·{" "}
                                                        {branch.changeHash?.substring(0, 8)}
                                                    </p>
                                                </div>
                                            </ItemField>
                                            <ItemField className="flex items-center my-auto">
                                                <a
                                                    className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase mb-1 cursor-pointer"
                                                    href={
                                                        prebuild
                                                            ? `/${
                                                                  !!team ? "t/" + team.slug : "projects"
                                                              }/${projectSlug}/${prebuild.info.id}`
                                                            : "javascript:void(0)"
                                                    }
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
                                                    <button
                                                        className={`primary mr-2 py-2 opacity-0 group-hover:opacity-100`}
                                                    >
                                                        New Workspace
                                                    </button>
                                                </a>
                                                <ItemFieldContextMenu
                                                    className="py-0.5"
                                                    menuEntries={
                                                        !prebuild ||
                                                        prebuild.status === "aborted" ||
                                                        prebuild.status === "failed" ||
                                                        prebuild.status === "timeout" ||
                                                        !!prebuild.error
                                                            ? [
                                                                  {
                                                                      title: `${prebuild ? "Rerun" : "Run"} Prebuild (${
                                                                          branch.name
                                                                      })`,
                                                                      onClick: () => triggerPrebuild(branch),
                                                                  },
                                                              ]
                                                            : prebuild.status === "building"
                                                            ? [
                                                                  {
                                                                      title: "Cancel Prebuild",
                                                                      customFontStyle:
                                                                          "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                                                      onClick: () =>
                                                                          prebuild && cancelPrebuild(prebuild.info.id),
                                                                  },
                                                              ]
                                                            : []
                                                    }
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

/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import moment from "moment";
import { PrebuildWithStatus } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { useHistory, useLocation, useRouteMatch } from "react-router";
import Header from "../components/Header";
import PrebuildLogs from "../components/PrebuildLogs";
import Spinner from "../icons/Spinner.svg";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { TeamsContext, getCurrentTeam } from "../teams/teams-context";
import { shortCommitMessage } from "./render-utils";

export default function () {
    const history = useHistory();
    const location = useLocation();

    const { teams } = useContext(TeamsContext);
    const team = getCurrentTeam(location, teams);

    const match = useRouteMatch<{ team: string; project: string; prebuildId: string }>(
        "/(t/)?:team/:project/:prebuildId",
    );
    const projectSlug = match?.params?.project;
    const prebuildId = match?.params?.prebuildId;

    const [prebuild, setPrebuild] = useState<PrebuildWithStatus | undefined>();
    const [isRerunningPrebuild, setIsRerunningPrebuild] = useState<boolean>(false);
    const [isCancellingPrebuild, setIsCancellingPrebuild] = useState<boolean>(false);

    useEffect(() => {
        if (!teams || !projectSlug || !prebuildId) {
            return;
        }
        (async () => {
            const projects = !!team
                ? await getGitpodService().server.getTeamProjects(team.id)
                : await getGitpodService().server.getUserProjects();

            const project =
                projectSlug && projects.find((p) => (!!p.slug ? p.slug === projectSlug : p.name === projectSlug));
            if (!project) {
                console.error(new Error(`Project not found! (teamId: ${team?.id}, projectName: ${projectSlug})`));
                return;
            }

            const prebuilds = await getGitpodService().server.findPrebuilds({
                projectId: project.id,
                prebuildId,
            });
            setPrebuild(prebuilds[0]);
        })();

        return getGitpodService().registerClient({
            onPrebuildUpdate(update: PrebuildWithStatus) {
                if (update.info.id !== prebuildId) {
                    return;
                }

                setPrebuild(update);
            },
        }).dispose;
    }, [prebuildId, projectSlug, team, teams]);

    const renderTitle = () => {
        if (!prebuild) {
            return "unknown prebuild";
        }
        return <h1 className="tracking-tight">{prebuild.info.branch} </h1>;
    };

    const renderSubtitle = () => {
        if (!prebuild) {
            return "";
        }
        const startedByAvatar = prebuild.info.startedByAvatar && (
            <img
                className="rounded-full w-4 h-4 inline-block align-text-bottom mr-2"
                src={prebuild.info.startedByAvatar || ""}
                alt={prebuild.info.startedBy}
            />
        );
        return (
            <div className="flex">
                <div className="my-auto">
                    <p>
                        {startedByAvatar}Triggered {moment(prebuild.info.startedAt).fromNow()}
                    </p>
                </div>
                <p className="mx-2 my-auto">·</p>
                <div className="my-auto">
                    <p className="text-gray-500 dark:text-gray-50">{shortCommitMessage(prebuild.info.changeTitle)}</p>
                </div>
                {!!prebuild.info.basedOnPrebuildId && (
                    <>
                        <p className="mx-2 my-auto">·</p>
                        <div className="my-auto">
                            <p className="text-gray-500 dark:text-gray-50">
                                Incremental Prebuild (
                                <a
                                    className="gp-link"
                                    title={prebuild.info.basedOnPrebuildId}
                                    href={`./${prebuild.info.basedOnPrebuildId}`}
                                >
                                    base
                                </a>
                                )
                            </p>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const rerunPrebuild = async () => {
        if (!prebuild) {
            return;
        }
        try {
            setIsRerunningPrebuild(true);
            await getGitpodService().server.triggerPrebuild(prebuild.info.projectId, prebuild.info.branch);
            // TODO: Open a Prebuilds page that's specific to `prebuild.info.branch`?
            history.push(`/${!!team ? "t/" + team.slug : "projects"}/${projectSlug}/prebuilds`);
        } catch (error) {
            console.error("Could not rerun prebuild", error);
        } finally {
            setIsRerunningPrebuild(false);
        }
    };

    const cancelPrebuild = async () => {
        if (!prebuild) {
            return;
        }
        try {
            setIsCancellingPrebuild(true);
            await getGitpodService().server.cancelPrebuild(prebuild.info.projectId, prebuild.info.id);
        } catch (error) {
            console.error("Could not cancel prebuild", error);
        } finally {
            setIsCancellingPrebuild(false);
        }
    };

    useEffect(() => {
        document.title = "Prebuild — Gitpod";
    }, []);

    return (
        <>
            <Header title={renderTitle()} subtitle={renderSubtitle()} />
            <div className="app-container mt-8">
                <PrebuildLogs workspaceId={prebuild?.info?.buildWorkspaceId}>
                    {["aborted", "timeout", "failed"].includes(prebuild?.status || "") || !!prebuild?.error ? (
                        <button
                            className="flex items-center space-x-2"
                            disabled={isRerunningPrebuild}
                            onClick={rerunPrebuild}
                        >
                            {isRerunningPrebuild && (
                                <img className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                            )}
                            <span>Rerun Prebuild ({prebuild?.info.branch})</span>
                        </button>
                    ) : ["building", "queued"].includes(prebuild?.status || "") ? (
                        <button
                            className="danger flex items-center space-x-2"
                            disabled={isCancellingPrebuild}
                            onClick={cancelPrebuild}
                        >
                            {isCancellingPrebuild && (
                                <img className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                            )}
                            <span>Cancel Prebuild</span>
                        </button>
                    ) : prebuild?.status === "available" ? (
                        <a
                            className="my-auto"
                            href={gitpodHostUrl.withContext(`${prebuild?.info.changeUrl}`).toString()}
                        >
                            <button>New Workspace ({prebuild?.info.branch})</button>
                        </a>
                    ) : (
                        <button disabled={true}>New Workspace ({prebuild?.info.branch})</button>
                    )}
                </PrebuildLogs>
            </div>
        </>
    );
}

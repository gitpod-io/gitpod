/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuildWithStatus } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Redirect, useHistory, useParams } from "react-router";
import Header from "../components/Header";
import PrebuildLogs from "../components/PrebuildLogs";
import { Subheading } from "../components/typography/headings";
import Spinner from "../icons/Spinner.svg";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useCurrentProject } from "./project-context";
import { shortCommitMessage } from "./render-utils";

export default function PrebuildPage() {
    const history = useHistory();
    const { project, loading } = useCurrentProject();

    const { prebuildId } = useParams<{ prebuildId: string }>();

    const [prebuild, setPrebuild] = useState<PrebuildWithStatus | undefined>();
    const [isRerunningPrebuild, setIsRerunningPrebuild] = useState<boolean>(false);
    const [isCancellingPrebuild, setIsCancellingPrebuild] = useState<boolean>(false);

    useEffect(() => {
        if (!project || !prebuildId) {
            return;
        }
        (async () => {
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
    }, [prebuildId, project]);

    const title = useMemo(() => {
        if (!prebuild) {
            return "unknown prebuild";
        }
        return prebuild.info.branch;
    }, [prebuild]);

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
                    <Subheading>
                        {startedByAvatar}Triggered {dayjs(prebuild.info.startedAt).fromNow()}
                    </Subheading>
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
            if (project) {
                history.push(`/projects/${project.id}/prebuilds`);
            }
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

    if (!loading && !project) {
        return <Redirect to={"/projects"} />;
    }

    return (
        <>
            <Header title={title} subtitle={renderSubtitle()} />
            <div className="app-container mt-8">
                <PrebuildLogs workspaceId={prebuild?.info?.buildWorkspaceId}>
                    {["building", "queued"].includes(prebuild?.status || "") ? (
                        <button
                            className="danger flex items-center space-x-2"
                            disabled={isCancellingPrebuild}
                            onClick={cancelPrebuild}
                        >
                            {isCancellingPrebuild && (
                                <img alt="" className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                            )}
                            <span>Cancel Prebuild</span>
                        </button>
                    ) : (
                        <>
                            <button
                                className="secondary flex items-center space-x-2"
                                disabled={isRerunningPrebuild}
                                onClick={rerunPrebuild}
                            >
                                {isRerunningPrebuild && (
                                    <img alt="" className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                                )}
                                <span>Rerun Prebuild ({prebuild?.info.branch})</span>
                            </button>
                            {prebuild?.status === "available" ? (
                                <a
                                    className="my-auto"
                                    href={gitpodHostUrl
                                        .withContext(`open-prebuild/${prebuild?.info.id}/${prebuild?.info.changeUrl}`)
                                        .toString()}
                                >
                                    <button>New Workspace (with this prebuild)</button>
                                </a>
                            ) : (
                                <button disabled={true}>New Workspace (with this prebuild)</button>
                            )}
                        </>
                    )}
                </PrebuildLogs>
            </div>
        </>
    );
}

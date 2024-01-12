/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Redirect, useHistory, useParams } from "react-router";
import Header from "../components/Header";
import PrebuildLogs from "../components/PrebuildLogs";
import { Subheading } from "../components/typography/headings";
import Spinner from "../icons/Spinner.svg";
import { useCurrentProject } from "./project-context";
import { shortCommitMessage } from "./render-utils";
import { prebuildClient, watchPrebuild } from "../service/public-api";
import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { gitpodHostUrl } from "../service/service";
import { Button } from "@podkit/buttons/Button";

export default function PrebuildPage() {
    const history = useHistory();
    const { project, loading } = useCurrentProject();

    const { prebuildId } = useParams<{ prebuildId: string }>();

    const [prebuild, setPrebuild] = useState<Prebuild | undefined>();
    const [isRerunningPrebuild, setIsRerunningPrebuild] = useState<boolean>(false);
    const [isCancellingPrebuild, setIsCancellingPrebuild] = useState<boolean>(false);

    useEffect(() => {
        if (!project || !prebuildId) {
            return;
        }
        const toCancelWatch = watchPrebuild(
            {
                scope: {
                    case: "prebuildId",
                    value: prebuildId,
                },
            },
            (prebuild) => setPrebuild(prebuild),
        );
        return () => toCancelWatch.dispose();
    }, [prebuildId, project]);

    const title = useMemo(() => {
        if (!prebuild) {
            return "unknown prebuild";
        }
        return prebuild.ref;
    }, [prebuild]);

    const renderSubtitle = () => {
        if (!prebuild) {
            return "";
        }
        return (
            <div className="flex">
                <div className="my-auto">
                    <Subheading>Triggered {dayjs(prebuild.status?.startTime?.toDate()).fromNow()}</Subheading>
                </div>
                <p className="mx-2 my-auto">·</p>
                <div className="my-auto">
                    <p className="text-gray-500 dark:text-gray-50">
                        {shortCommitMessage(prebuild.commit?.message || "")}
                    </p>
                </div>
                {!!prebuild.basedOnPrebuildId && (
                    <>
                        <p className="mx-2 my-auto">·</p>
                        <div className="my-auto">
                            <p className="text-gray-500 dark:text-gray-50">
                                Incremental Prebuild (
                                <a
                                    className="gp-link"
                                    title={prebuild.basedOnPrebuildId}
                                    href={`./${prebuild.basedOnPrebuildId}`}
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
            await prebuildClient.startPrebuild({
                configurationId: prebuild.configurationId,
                gitRef: prebuild.ref,
            });
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
            await prebuildClient.cancelPrebuild({
                prebuildId: prebuild.id,
            });
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
                <PrebuildLogs workspaceId={prebuild?.workspaceId}>
                    {[PrebuildPhase_Phase.BUILDING, PrebuildPhase_Phase.QUEUED].includes(
                        prebuild?.status?.phase?.name || PrebuildPhase_Phase.UNSPECIFIED,
                    ) ? (
                        <Button
                            variant="destructive"
                            className="flex items-center space-x-2"
                            disabled={isCancellingPrebuild}
                            onClick={cancelPrebuild}
                        >
                            {isCancellingPrebuild && (
                                <img alt="" className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                            )}
                            <span>Cancel Prebuild</span>
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="secondary"
                                className="flex items-center space-x-2"
                                disabled={isRerunningPrebuild}
                                onClick={rerunPrebuild}
                            >
                                {isRerunningPrebuild && (
                                    <img alt="" className="h-4 w-4 animate-spin filter brightness-150" src={Spinner} />
                                )}
                                <span>Rerun Prebuild ({prebuild?.ref})</span>
                            </Button>
                            {prebuild?.status?.phase?.name === PrebuildPhase_Phase.AVAILABLE ? (
                                <a
                                    className="my-auto"
                                    href={gitpodHostUrl
                                        .withContext(`open-prebuild/${prebuild?.id}/${prebuild?.contextUrl}`)
                                        .toString()}
                                >
                                    <Button>New Workspace (with this prebuild)</Button>
                                </a>
                            ) : (
                                <Button disabled={true}>New Workspace (with this prebuild)</Button>
                            )}
                        </>
                    )}
                </PrebuildLogs>
            </div>
        </>
    );
}

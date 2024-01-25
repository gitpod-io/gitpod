/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Timestamp } from "@bufbuild/protobuf";
import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Button } from "@podkit/buttons/Button";
import { FC, Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { useConfiguration } from "../../../data/configurations/configuration-queries";
import { AlertTriangleIcon, CheckCircle2Icon, CircleSlash2Icon, Loader2Icon } from "lucide-react";
import dayjs from "dayjs";
import { usePrebuildLogsEmitter } from "../../../data/prebuilds/prebuild-logs-emitter";
import React from "react";

const WorkspaceLogs = React.lazy(() => import("../../../components/WorkspaceLogs"));

interface PageRouteParams {
    repositoryId: string;
    prebuildId: string;
}

export const PrebuildDetailPage: FC = () => {
    const { repositoryId, prebuildId } = useParams<PageRouteParams>();

    const { data: repository } = useConfiguration(repositoryId);

    const { emitter: logEmitter, error: logError } = usePrebuildLogsEmitter(prebuildId);

    const prebuild = useMemo<Prebuild>(() => {
        return new Prebuild({
            id: prebuildId,
            workspaceId: "hello",
            configurationId: repositoryId,
            ref: "develop",
            commit: {
                message: "Fix text color in BreadcrumbNav component",
                author: {
                    name: "Terry Jenkins",
                    avatarUrl: "https://avatars.githubusercontent.com/u/1234567?v=4",
                },
                authorDate: Timestamp.fromDate(new Date()),
                sha: "3feda1cbd",
            },
            contextUrl: "https://github.com/gitpod-io/gitpod",
            status: {
                phase: {
                    name: PrebuildPhase_Phase.BUILDING,
                },
                startTime: Timestamp.fromDate(new Date()),
                message: "",
            },
        });
    }, [prebuildId, repositoryId]);

    const prebuildPhase = useMemo(() => {
        switch (prebuild.status?.phase?.name) {
            case PrebuildPhase_Phase.QUEUED:
                return {
                    icon: <Loader2Icon size={20} className="text-gray-500" />,
                    description: "Prebuild queue",
                };
            case PrebuildPhase_Phase.BUILDING:
                return {
                    icon: <CheckCircle2Icon size={20} className="text-green-500" />,
                    description: "Prebuild building",
                };
            case PrebuildPhase_Phase.ABORTED:
                return {
                    icon: <CircleSlash2Icon size={20} className="text-gray-500" />,
                    description: "Prebuild aborted",
                };
            case PrebuildPhase_Phase.TIMEOUT:
                return {
                    icon: <CircleSlash2Icon size={20} className="text-gray-500" />,
                    description: "Prebuild timeout",
                };
            case PrebuildPhase_Phase.AVAILABLE:
                return {
                    icon: <CheckCircle2Icon size={20} className="text-green-500" />,
                    description: "Prebuild available",
                };
            case PrebuildPhase_Phase.FAILED:
                return {
                    icon: <AlertTriangleIcon size={20} className="text-kumquat-base" />,
                    description: "Prebuild available",
                };

            case PrebuildPhase_Phase.UNSPECIFIED:
            default:
                return {
                    icon: <CircleSlash2Icon size={20} className="text-gray-500" />,
                    description: "Prebuild unknown",
                };
        }
    }, [prebuild.status?.phase?.name]);

    return (
        <div className="w-full">
            <BreadcrumbNav
                pageTitle="Prebuild history"
                pageDescription={
                    <>
                        {repository?.name} <span className="text-pk-content-secondary">{prebuild.ref}</span>
                    </>
                }
                backLink="/repositories"
            />
            <div className="app-container mb-8">
                <div className={"border border-pk-border-base rounded-xl py-6 divide-y"}>
                    <div className="px-6 pb-4">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between">
                                <div className="font-semibold text-pk-content-primary">{prebuild.commit?.message}</div>
                                <div className=" text-pk-content-secondary">
                                    {"Triggered " + dayjs().add(-1.2, "days").fromNow()}
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <img
                                    className="w-5 h-5 rounded-full"
                                    src={prebuild.commit?.author?.avatarUrl}
                                    alt="author avatar"
                                />
                                <span className=" text-pk-content-secondary">{prebuild.commit?.author?.name}</span>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 flex gap-1 items-center">
                        {prebuildPhase.icon}
                        <span>{prebuildPhase.description}</span>
                    </div>
                    <div className="h-96">
                        <Suspense fallback={<div />}>
                            <WorkspaceLogs
                                classes="h-full w-full"
                                xtermClasses="absolute top-0 left-0 bottom-0 right-0 mx-6 my-0"
                                logsEmitter={logEmitter}
                                errorMessage={logError?.message}
                            />
                        </Suspense>
                    </div>
                    <div className="px-6 pt-4 flex justify-between">
                        <Button>Rerun Prebuild (main)</Button>
                        <Button variant="secondary">View Imported Repository</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

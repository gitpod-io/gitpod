/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Button } from "@podkit/buttons/Button";
import { FC, Suspense, useEffect, useMemo } from "react";
import { useParams } from "react-router";
import { useConfiguration } from "../../../data/configurations/configuration-queries";
import { AlertTriangleIcon, CheckCircle2Icon, CircleSlash2Icon, Loader2Icon, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import { usePrebuildLogsEmitter } from "../../../data/prebuilds/prebuild-logs-emitter";
import React from "react";
import { useToast } from "../../../components/toasts/Toasts";
import { usePrebuildQuery } from "../../../data/prebuilds/prebuild-query";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { repositoriesRoutes } from "../../repositories.routes";

const WorkspaceLogs = React.lazy(() => import("../../../components/WorkspaceLogs"));

interface PageRouteParams {
    repositoryId: string;
    prebuildId: string;
}

export const PrebuildDetailPage: FC = () => {
    const { repositoryId, prebuildId } = useParams<PageRouteParams>();

    const { data: repository, isLoading: repositoryIsLoading } = useConfiguration(repositoryId);
    const { toast } = useToast();

    // TODO: watch
    const { data: prebuild, isLoading: prebuildIsLoading } = usePrebuildQuery(prebuildId);

    const { emitter: logEmitter } = usePrebuildLogsEmitter(prebuildId);

    useEffect(() => {
        logEmitter.on("error", (err: Error) => {
            toast("Failed to fetch logs: " + err.message);
        });
    }, [logEmitter, toast]);

    const prebuildPhase = useMemo(() => {
        switch (prebuild?.status?.phase?.name) {
            case PrebuildPhase_Phase.QUEUED:
                return {
                    icon: <Loader2Icon size={20} className="text-gray-500 animate-spin" />,
                    description: "Prebuild queue",
                };
            case PrebuildPhase_Phase.BUILDING:
                return {
                    icon: <Loader2Icon size={20} className="text-gray-500 animate-spin" />,
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
    }, [prebuild?.status?.phase?.name]);

    return (
        <div className="w-full">
            <BreadcrumbNav
                pageTitle="Prebuild history"
                pageDescription={
                    <>
                        <span className="font-semibold">{repository?.name || ""}</span>{" "}
                        <span className="text-pk-content-secondary">{prebuild?.ref || ""}</span>
                    </>
                }
                backLink="/repositories"
            />
            {(repositoryIsLoading || prebuildIsLoading) && <Loader2 className="animate-spin" />}
            {prebuild && (
                <div className="app-container mb-8">
                    <div className={"border border-pk-border-base rounded-xl py-6 divide-y"}>
                        <div className="px-6 pb-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between">
                                    <div className="font-semibold text-pk-content-primary">
                                        {prebuild.commit?.message}
                                    </div>
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
                        <div className="h-112">
                            <Suspense fallback={<div />}>
                                <WorkspaceLogs
                                    classes="h-full w-full"
                                    xtermClasses="absolute top-0 left-0 bottom-0 right-0 mx-6 my-0"
                                    logsEmitter={logEmitter}
                                />
                            </Suspense>
                        </div>
                        <div className="px-6 pt-6 flex justify-between">
                            <Button>{`Rerun Prebuild (${prebuild.ref})`}</Button>
                            <LinkButton href={repositoriesRoutes.Detail(repositoryId)} variant="secondary">
                                View Imported Repository
                            </LinkButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

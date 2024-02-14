/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Button } from "@podkit/buttons/Button";
import { FC, Suspense, useEffect, useMemo, useState } from "react";
import { Redirect, useParams } from "react-router";
import { CircleSlash2, Loader2Icon } from "lucide-react";
import dayjs from "dayjs";
import { usePrebuildLogsEmitter } from "../../../data/prebuilds/prebuild-logs-emitter";
import React from "react";
import { useToast } from "../../../components/toasts/Toasts";
import {
    usePrebuildAndConfigurationQuery,
    useTriggerPrebuildQuery,
    watchPrebuild,
} from "../../../data/prebuilds/prebuild-query";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { repositoriesRoutes } from "../../repositories.routes";
import { LoadingState } from "@podkit/loading/LoadingState";
import Alert from "../../../components/Alert";
import { prebuildDisplayProps, prebuildStatusIconComponent } from "../../../projects/prebuild-utils";
import { LoadingButton } from "@podkit/buttons/LoadingButton";

const WorkspaceLogs = React.lazy(() => import("../../../components/WorkspaceLogs"));

/**
 * Formats a date. For today, it returns the time. For this year, it returns the month and day and time. Otherwise, it returns the full date and time.
 */
const formatDate = (date: dayjs.Dayjs): string => {
    if (date.isSame(dayjs(), "day")) {
        return date.format("[today at] h:mm A");
    }

    if (date.isSame(dayjs(), "year")) {
        return date.format("MMM D h:mm A");
    }

    return date.format("MMM D, YYYY h:mm A");
};

interface Props {
    prebuildId: string;
}
export const PrebuildDetailPage: FC = () => {
    const { prebuildId } = useParams<Props>();

    const { data: info, isLoading: infoIsLoading, error, refetch } = usePrebuildAndConfigurationQuery(prebuildId);
    const { toast } = useToast();
    const [currentPrebuild, setCurrentPrebuild] = useState<Prebuild | undefined>();

    const { emitter: logEmitter } = usePrebuildLogsEmitter(prebuildId);
    const {
        isFetching: isTriggeringPrebuild,
        refetch: triggerPrebuild,
        isError: isTriggerError,
        error: triggerError,
        isRefetching: isTriggeringRefetch,
        data: newPrebuildID,
    } = useTriggerPrebuildQuery(info?.configuration?.id, info?.prebuild?.ref);

    const triggeredDate = useMemo(
        () => dayjs(info?.prebuild?.status?.startTime?.toDate()),
        [info?.prebuild?.status?.startTime],
    );
    const triggeredString = useMemo(() => formatDate(triggeredDate), [triggeredDate]);

    useEffect(() => {
        watchPrebuild(prebuildId, (prebuild) => {
            setCurrentPrebuild(prebuild);
        });
    }, [prebuildId, setCurrentPrebuild]);

    useEffect(() => {
        logEmitter.on("error", (err: Error) => {
            if (err?.name === "AbortError") {
                return;
            }
            if (err?.message) {
                toast("Failed to fetch logs: " + err.message);
            }
        });
    }, [logEmitter, toast]);

    useEffect(() => {
        if (isTriggerError && triggerError?.message) {
            toast("Failed to trigger prebuild: " + triggerError.message);
        }
    }, [isTriggerError, triggerError, toast]);

    // TODO: should reuse icon/description on prebuild list
    const prebuildPhase = useMemo(() => {
        const name = currentPrebuild?.status?.phase?.name;
        if (!name) {
            return {
                icon: <CircleSlash2 size={20} className="text-gray-500" />,
                description: "Unknown prebuild status.",
            };
        }

        const loaderIcon = <Loader2Icon size={20} className="text-gray-500 animate-spin" />;
        switch (currentPrebuild?.status?.phase?.name) {
            case PrebuildPhase_Phase.QUEUED:
                return {
                    icon: loaderIcon,
                    description: "Prebuild queued",
                };
            case PrebuildPhase_Phase.BUILDING:
                return {
                    icon: loaderIcon,
                    description: "Prebuild in progress",
                };
            default:
                const props = prebuildDisplayProps(currentPrebuild);
                const Icon = prebuildStatusIconComponent(currentPrebuild);

                return {
                    description: props.label,
                    icon: <Icon className={props.className} />,
                };
        }
    }, [currentPrebuild]);

    if (newPrebuildID) {
        return <Redirect to={repositoriesRoutes.PrebuildDetail(newPrebuildID)} />;
    }

    return (
        <div className="w-full">
            <BreadcrumbNav
                pageTitle="Prebuild history"
                pageDescription={
                    <>
                        <span className="font-semibold">
                            {!infoIsLoading ? info?.configuration?.name : "" ?? "unknown repository"}
                        </span>{" "}
                        <span className="text-pk-content-secondary">{info?.prebuild?.ref ?? ""}</span>
                    </>
                }
                backLink={repositoriesRoutes.Prebuilds()}
            />
            <div className="app-container mb-8">
                {infoIsLoading && (
                    <div className="flex justify-center">
                        <LoadingState />
                    </div>
                )}
                {error ? (
                    <div className="flex flex-col gap-4">
                        <Alert type="error">
                            <span>Failed to load prebuild</span>
                            <pre>{error.message}</pre>
                        </Alert>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                refetch();
                            }}
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
                    info?.prebuild && (
                        <div className={"border border-pk-border-base rounded-xl py-6 divide-y"}>
                            <div className="px-6 pb-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between">
                                        <div className="font-semibold text-pk-content-primary truncate">
                                            {info.prebuild.commit?.message}
                                        </div>
                                        {triggeredString && (
                                            <div className="text-pk-content-secondary flex-none">
                                                Triggered{" "}
                                                <time
                                                    dateTime={triggeredDate.toISOString()}
                                                    title={triggeredDate.toString()}
                                                >
                                                    {triggeredString}
                                                </time>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        <img
                                            className="w-5 h-5 rounded-full"
                                            src={info.prebuild.commit?.author?.avatarUrl}
                                            alt=""
                                        />
                                        <span className="text-pk-content-secondary">
                                            {info.prebuild.commit?.author?.name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 flex flex-col gap-1 border-pk-border-base">
                                <div className="flex gap-1 items-center capitalize">
                                    {prebuildPhase.icon}
                                    <span>{prebuildPhase.description}</span>
                                </div>
                                {info.prebuild.status?.message && (
                                    <div className="text-pk-content-secondary truncate">
                                        {info.prebuild.status.message}
                                    </div>
                                )}
                            </div>
                            <div className="h-112 border-pk-border-base">
                                <Suspense fallback={<div />}>
                                    <WorkspaceLogs
                                        classes="h-full w-full"
                                        xtermClasses="absolute top-0 left-0 bottom-0 right-0 mx-6 my-0"
                                        logsEmitter={logEmitter}
                                    />
                                </Suspense>
                            </div>
                            <div className="px-6 pt-6 flex justify-between border-pk-border-base">
                                <LoadingButton
                                    loading={isTriggeringRefetch}
                                    disabled={
                                        isTriggeringPrebuild || !info.configuration?.id || !info.prebuild.commit?.sha
                                    }
                                    onClick={() => triggerPrebuild()}
                                >{`Rerun Prebuild (${info.prebuild.ref})`}</LoadingButton>
                                <LinkButton
                                    disabled={!info.configuration?.id}
                                    href={repositoriesRoutes.Detail(info.configuration!.id!)}
                                    variant="secondary"
                                >
                                    View Imported Repository
                                </LinkButton>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Prebuild, PrebuildPhase_Phase, TaskLog } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Button } from "@podkit/buttons/Button";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router";
import dayjs from "dayjs";
import { useToast } from "../../components/toasts/Toasts";
import {
    isPrebuildDone,
    useCancelPrebuildMutation,
    usePrebuildQuery,
    useTriggerPrebuildMutation,
    watchPrebuild,
} from "../../data/prebuilds/prebuild-queries";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { repositoriesRoutes } from "../../repositories/repositories.routes";
import { LoadingState } from "@podkit/loading/LoadingState";
import Alert from "../../components/Alert";
import { PrebuildStatus } from "../../projects/prebuild-utils";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Tabs, TabsList, TabsTrigger } from "@podkit/tabs/Tabs";
import { PrebuildTaskTab } from "./PrebuildTaskTab";
import type { PlainMessage } from "@bufbuild/protobuf";
import { PrebuildTaskErrorTab } from "./PrebuildTaskErrorTab";
import Tooltip from "../../components/Tooltip";

/**
 * Formats a date. For today, it returns the time. For this year, it returns the month and day and time. Otherwise, it returns the full date and time.
 */
const formatDate = (date: dayjs.Dayjs): string => {
    if (date.isSame(dayjs(), "day")) {
        return date.format("[today at] h:mm A");
    }

    if (date.isSame(dayjs(), "year")) {
        return date.format("MMM D [at] h:mm A");
    }

    return date.format("MMM D, YYYY [at] h:mm A");
};

interface Props {
    prebuildId: string;
}
export const PrebuildDetailPage: FC = () => {
    const { prebuildId } = useParams<Props>();

    const { data: initialPrebuild, isLoading: isInfoLoading, error, refetch } = usePrebuildQuery(prebuildId);
    const [currentPrebuild, setCurrentPrebuild] = useState<Prebuild | undefined>();

    let prebuild = initialPrebuild;
    if (currentPrebuild && prebuildId === currentPrebuild.id) {
        // Make sure we update only if it's the same prebuild
        prebuild = currentPrebuild;
    }

    const history = useHistory();
    const { toast } = useToast();
    const [selectedTaskId, actuallySetSelectedTaskId] = useState<string | undefined>();

    const hashTaskId = window.location.hash.slice(1);
    useEffect(() => {
        actuallySetSelectedTaskId(hashTaskId || undefined);
    }, [hashTaskId]);

    const isImageBuild =
        prebuild?.status?.phase?.name === PrebuildPhase_Phase.QUEUED && !!prebuild.status.imageBuildLogUrl;
    const taskId = useMemo(() => {
        if (!prebuild) {
            return undefined;
        }
        if (isImageBuild) {
            return "image-build";
        }

        return selectedTaskId ?? prebuild?.status?.taskLogs.filter((f) => f.logUrl)[0]?.taskId ?? undefined;
    }, [isImageBuild, prebuild, selectedTaskId]);

    const triggerPrebuildMutation = useTriggerPrebuildMutation(prebuild?.configurationId, prebuild?.ref);
    const cancelPrebuildMutation = useCancelPrebuildMutation();

    const [isTriggeringNewPrebuild, setTriggeringNewPrebuild] = useState(false);
    const triggerPrebuild = useCallback(async () => {
        if (!prebuild) {
            return;
        }

        try {
            setTriggeringNewPrebuild(true);
            await triggerPrebuildMutation.mutateAsync(undefined, {
                onSuccess: (newPrebuildId) => {
                    history.push(repositoriesRoutes.PrebuildDetail(newPrebuildId));
                },
                onError: (error) => {
                    if (error instanceof ApplicationError) {
                        toast("Failed to trigger prebuild: " + error.message);
                    }
                },
                onSettled: () => {
                    setTriggeringNewPrebuild(false);
                },
            });
        } catch (error) {
            console.error("Could not trigger prebuild", error);
        }
    }, [history, prebuild, toast, triggerPrebuildMutation]);

    const triggeredDate = useMemo(() => dayjs(prebuild?.status?.startTime?.toDate()), [prebuild?.status?.startTime]);
    const triggeredString = useMemo(() => formatDate(triggeredDate), [triggeredDate]);
    const stopDate = useMemo(() => {
        if (!prebuild?.status?.stopTime) {
            return undefined;
        }
        return dayjs(prebuild.status.stopTime.toDate());
    }, [prebuild?.status?.stopTime]);
    const stopString = useMemo(() => (stopDate ? formatDate(stopDate) : undefined), [stopDate]);
    const durationString = useMemo(() => {
        if (!prebuild?.status?.startTime || !prebuild?.status?.stopTime) {
            return undefined;
        }
        const duration = dayjs.duration(
            prebuild.status.stopTime.toDate().getTime() - prebuild.status.startTime.toDate().getTime(),
            "milliseconds",
        );

        const s = duration.get("s");
        const m = duration.get("m");
        const h = duration.get("h");
        if (h >= 1) {
            return `${h}h ${m}m ${s}s`;
        }
        if (m >= 1) {
            return `${m}m ${s}s`;
        }
        return `${s}s`;
    }, [prebuild?.status?.startTime, prebuild?.status?.stopTime]);

    const setSelectedTaskId = useCallback(
        (taskId: string) => {
            actuallySetSelectedTaskId(taskId);

            history.push({
                hash: taskId,
            });
        },
        [history],
    );

    useEffect(() => {
        const disposable = watchPrebuild(prebuildId, (prebuild) => {
            setCurrentPrebuild(prebuild);

            return isPrebuildDone(prebuild);
        });

        return () => {
            disposable.dispose();
        };
    }, [prebuildId]);

    const prebuildTasks = useMemo(() => {
        const validTasks: Omit<PlainMessage<TaskLog>, "taskJson">[] =
            prebuild?.status?.taskLogs.filter((t) => t.logUrl) ?? [];
        if (isImageBuild) {
            validTasks.unshift({
                taskId: "image-build",
                taskLabel: "Image Build",
                logUrl: prebuild?.status?.imageBuildLogUrl!, // we know this is defined because we're in the isImageBuild branch
            });
        }

        return validTasks;
    }, [isImageBuild, prebuild?.status?.imageBuildLogUrl, prebuild?.status?.taskLogs]);

    const notFoundError = error instanceof ApplicationError && error.code === ErrorCodes.NOT_FOUND;

    const cancelPrebuild = useCallback(async () => {
        if (!prebuild) {
            return;
        }

        try {
            await cancelPrebuildMutation.mutateAsync(prebuild.id);
        } catch (error) {
            console.error("Could not cancel prebuild", error);
        }
    }, [prebuild, cancelPrebuildMutation]);

    return (
        <div className="w-full">
            <BreadcrumbNav
                pageTitle="Prebuild history"
                pageDescription={
                    !isInfoLoading && (
                        <>
                            <span className="font-semibold">{prebuild?.configurationName ?? "unknown repository"}</span>{" "}
                            <span className="text-pk-content-secondary">{prebuild?.ref ?? ""}</span>
                        </>
                    )
                }
                backLink={repositoriesRoutes.Prebuilds()}
            />
            <div className="app-container mb-8">
                {isInfoLoading && (
                    <div className="flex justify-center">
                        <LoadingState />
                    </div>
                )}
                {error ? (
                    <div className="flex flex-col gap-4">
                        <Alert type="error">
                            <span>Failed to load prebuild</span>
                            <pre>{notFoundError ? "Prebuild not found" : error.message}</pre>
                        </Alert>
                        {!notFoundError && (
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    refetch();
                                }}
                            >
                                Retry
                            </Button>
                        )}
                    </div>
                ) : (
                    prebuild && (
                        <div className={"border border-pk-border-base rounded-xl pt-6 pb-3 divide-y"}>
                            <div className="px-6 pb-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between">
                                        <div className="space-y-2 font-semibold text-pk-content-primary truncate">
                                            {prebuild.commit?.message}{" "}
                                            {prebuild.commit?.sha && (
                                                <span>
                                                    <Tooltip content={prebuild.commit.sha}>
                                                        (
                                                        <span className="font-mono">
                                                            {prebuild.commit.sha.slice(0, 7)}
                                                        </span>
                                                        )
                                                    </Tooltip>
                                                </span>
                                            )}
                                            <div className="flex gap-1 items-center">
                                                <img
                                                    className="w-5 h-5 rounded-full"
                                                    src={prebuild.commit?.author?.avatarUrl}
                                                    alt=""
                                                />
                                                <span className="text-pk-content-secondary">
                                                    {prebuild.commit?.author?.name}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-pk-content-secondary flex-none">
                                            {triggeredString && (
                                                <>
                                                    <div>
                                                        Triggered:{" "}
                                                        <time
                                                            dateTime={triggeredDate.toISOString()}
                                                            title={triggeredDate.toString()}
                                                        >
                                                            {triggeredString}
                                                        </time>
                                                    </div>
                                                    {stopDate && (
                                                        <>
                                                            <div>
                                                                Stopped:{" "}
                                                                <time
                                                                    dateTime={stopDate.toISOString()}
                                                                    title={stopDate.toString()}
                                                                >
                                                                    {stopString}
                                                                </time>
                                                            </div>
                                                            <div>Duration: {durationString}</div>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 border-pk-border-base">
                                <div className="py-4 px-6 flex flex-col gap-1">
                                    <PrebuildStatus prebuild={prebuild} />
                                    {prebuild?.status?.message && (
                                        <div className="text-pk-content-secondary line-clamp-2">
                                            {prebuild?.status.message}
                                        </div>
                                    )}
                                </div>
                                <Tabs value={taskId ?? "empty-tab"} onValueChange={setSelectedTaskId} className="p-0">
                                    <TabsList className="overflow-x-auto max-w-full p-0 h-auto items-end">
                                        {prebuildTasks.map((task) => (
                                            <TabsTrigger
                                                value={task.taskId}
                                                key={prebuildId + task.taskId}
                                                data-analytics={JSON.stringify({ dnt: true })}
                                                className="mt-1 font-normal text-base pt-2 px-4 rounded-t-lg border border-pk-border-base border-b-0 border-l-0 data-[state=active]:bg-pk-surface-secondary data-[state=active]:z-10 data-[state=active]:relative last:mr-1"
                                                disabled={task.taskId !== "image-build" && isImageBuild}
                                            >
                                                {task.taskLabel}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    {prebuildTasks.length !== 0 ? (
                                        prebuildTasks.map(({ taskId }) => (
                                            <PrebuildTaskTab
                                                key={prebuildId + taskId}
                                                taskId={taskId}
                                                prebuild={prebuild}
                                            />
                                        ))
                                    ) : (
                                        <PrebuildTaskErrorTab>
                                            No prebuild tasks defined in <code>.gitpod.yml</code> for this prebuild
                                        </PrebuildTaskErrorTab>
                                    )}
                                </Tabs>
                            </div>
                            <div className="px-6 pt-6 pb-3 flex justify-between border-pk-border-base overflow-y-hidden gap-4">
                                {[PrebuildPhase_Phase.BUILDING, PrebuildPhase_Phase.QUEUED].includes(
                                    prebuild?.status?.phase?.name ?? PrebuildPhase_Phase.UNSPECIFIED,
                                ) ? (
                                    <LoadingButton
                                        loading={cancelPrebuildMutation.isLoading}
                                        disabled={cancelPrebuildMutation.isLoading}
                                        onClick={cancelPrebuild}
                                        variant={"destructive"}
                                    >
                                        Cancel Prebuild
                                    </LoadingButton>
                                ) : (
                                    <LoadingButton
                                        loading={isTriggeringNewPrebuild}
                                        disabled={
                                            isTriggeringNewPrebuild ||
                                            !prebuild.configurationId ||
                                            !prebuild.commit?.sha
                                        }
                                        onClick={() => triggerPrebuild()}
                                    >{`Rerun Prebuild (${prebuild.ref})`}</LoadingButton>
                                )}
                                <div className="gap-4 flex justify-right">
                                    <LinkButton
                                        disabled={!prebuild?.id}
                                        href={repositoriesRoutes.PrebuildsSettings(prebuild.configurationId)}
                                        variant="secondary"
                                    >
                                        View Prebuild Settings
                                    </LinkButton>
                                    <LinkButton
                                        disabled={prebuild?.status?.phase?.name !== PrebuildPhase_Phase.AVAILABLE}
                                        href={`/#open-prebuild/${prebuild?.id}/${prebuild?.contextUrl}`}
                                        variant="secondary"
                                    >
                                        Open Debug Workspace
                                    </LinkButton>
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

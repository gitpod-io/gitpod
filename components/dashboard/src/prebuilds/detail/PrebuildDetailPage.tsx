/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Prebuild, PrebuildPhase_Phase, TaskLog } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Button } from "@podkit/buttons/Button";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useHistory, useParams } from "react-router";
import dayjs from "dayjs";
import { useToast } from "../../components/toasts/Toasts";
import {
    isPrebuildDone,
    useCancelPrebuildMutation,
    usePrebuildQuery,
    useTriggerPrebuildQuery,
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

export const PersistedToastID = "prebuild-logs-error";
interface Props {
    prebuildId: string;
}
export const PrebuildDetailPage: FC = () => {
    const { prebuildId } = useParams<Props>();

    const { data: initialPrebuild, isLoading: isInfoLoading, error, refetch } = usePrebuildQuery(prebuildId);
    const [currentPrebuild, setCurrentPrebuild] = useState<Prebuild | undefined>();
    const prebuild = currentPrebuild ?? initialPrebuild;

    const history = useHistory();
    const { toast, dismissToast } = useToast();
    const [selectedTaskId, actuallySetSelectedTaskId] = useState<string | undefined>(
        window.location.hash.slice(1) || undefined,
    );

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

    const {
        isFetching: isTriggeringPrebuild,
        refetch: triggerPrebuild,
        isError: isTriggerError,
        error: triggerError,
        isRefetching: isTriggeringRefetch,
        data: newPrebuildID,
    } = useTriggerPrebuildQuery(prebuild?.configurationId, prebuild?.ref);
    const cancelPrebuildMutation = useCancelPrebuildMutation();

    const triggeredDate = useMemo(() => dayjs(prebuild?.status?.startTime?.toDate()), [prebuild?.status?.startTime]);
    const triggeredString = useMemo(() => formatDate(triggeredDate), [triggeredDate]);

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

    useEffect(() => {
        history.listen(() => {
            dismissToast(PersistedToastID);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const notFoundError = error instanceof ApplicationError && error.code === ErrorCodes.NOT_FOUND;

    useEffect(() => {
        if (isTriggerError && triggerError?.message) {
            toast("Failed to trigger prebuild: " + triggerError.message);
        }
    }, [isTriggerError, triggerError, toast]);

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

    // For some reason, we sometimes hit a case where the newPrebuildID is actually set without us triggering the query.
    if (newPrebuildID && prebuild?.id !== newPrebuildID) {
        return <Redirect to={repositoriesRoutes.PrebuildDetail(newPrebuildID)} />;
    }

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
                        <div className={"border border-pk-border-base rounded-xl py-6 divide-y"}>
                            <div className="px-6 pb-4">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between">
                                        <div className="font-semibold text-pk-content-primary truncate">
                                            {prebuild.commit?.message}
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
                                            src={prebuild.commit?.author?.avatarUrl}
                                            alt=""
                                        />
                                        <span className="text-pk-content-secondary">
                                            {prebuild.commit?.author?.name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 border-pk-border-base">
                                <div className="py-4 px-6 flex flex-col gap-1">
                                    <PrebuildStatus prebuild={prebuild} />
                                    {prebuild?.status?.message && (
                                        <div className="text-pk-content-secondary truncate">
                                            {prebuild?.status.message}
                                        </div>
                                    )}
                                </div>
                                <Tabs value={taskId ?? "empty-tab"} onValueChange={setSelectedTaskId} className="p-0">
                                    <TabsList className="overflow-x-auto max-w-full p-0 h-auto items-end">
                                        {prebuildTasks.map((task) => (
                                            <TabsTrigger
                                                value={task.taskId}
                                                key={task.taskId}
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
                                            <PrebuildTaskTab key={taskId} taskId={taskId} prebuild={prebuild} />
                                        ))
                                    ) : (
                                        <PrebuildTaskErrorTab>
                                            No prebuild tasks defined in <code>.gitpod.yml</code> for this prebuild
                                        </PrebuildTaskErrorTab>
                                    )}
                                </Tabs>
                            </div>
                            <div className="px-6 pt-6 flex justify-between border-pk-border-base">
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
                                        loading={isTriggeringRefetch}
                                        disabled={
                                            isTriggeringPrebuild || !prebuild.configurationId || !prebuild.commit?.sha
                                        }
                                        onClick={() => triggerPrebuild()}
                                    >{`Rerun Prebuild (${prebuild.ref})`}</LoadingButton>
                                )}
                                <div className="space-x-6 flex justify-right">
                                    <LinkButton
                                        disabled={!prebuild?.id}
                                        href={repositoriesRoutes.PrebuildsSettings(prebuild.configurationId)}
                                        variant="secondary"
                                    >
                                        View Prebuild Settings
                                    </LinkButton>
                                    <LoadingButton
                                        loading={false}
                                        disabled={prebuild?.status?.phase?.name !== PrebuildPhase_Phase.AVAILABLE}
                                        onClick={() =>
                                            (window.location.href = `/#open-prebuild/${prebuild?.id}/${prebuild?.contextUrl}`)
                                        }
                                        variant="default"
                                    >
                                        Open Debug Workspace
                                    </LoadingButton>
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

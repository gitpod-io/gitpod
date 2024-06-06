/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Prebuild, PrebuildPhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Text } from "@podkit/typography/Text";
import { Button } from "@podkit/buttons/Button";
import { FC, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Redirect, useHistory, useParams } from "react-router";
import { CircleSlash, Loader2Icon } from "lucide-react";
import dayjs from "dayjs";
import { usePrebuildLogsEmitter } from "../../data/prebuilds/prebuild-logs-emitter";
import React from "react";
import { useToast } from "../../components/toasts/Toasts";
import {
    useCancelPrebuildMutation,
    usePrebuildQuery,
    useTriggerPrebuildQuery,
    watchPrebuild,
} from "../../data/prebuilds/prebuild-queries";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { repositoriesRoutes } from "../../repositories/repositories.routes";
import { LoadingState } from "@podkit/loading/LoadingState";
import Alert from "../../components/Alert";
import { prebuildDisplayProps, prebuildStatusIconComponent } from "../../projects/prebuild-utils";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { MiddleDot } from "../../components/typography/MiddleDot";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@podkit/tabs/Tabs";

const WorkspaceLogs = React.lazy(() => import("../../components/WorkspaceLogs"));

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

const PersistedToastID = "prebuild-logs-error";

interface Props {
    prebuildId: string;
}
export const PrebuildDetailPage: FC = () => {
    const { prebuildId } = useParams<Props>();

    const { data: prebuild, isLoading: isInfoLoading, error, refetch } = usePrebuildQuery(prebuildId);

    const history = useHistory();
    const { toast, dismissToast } = useToast();
    const [currentPrebuild, setCurrentPrebuild] = useState<Prebuild | undefined>();
    const [logNotFound, setLogNotFound] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);

    const taskId = selectedTaskId ?? currentPrebuild?.status?.taskLogs.filter((f) => f.logUrl)[0]?.taskId ?? "0";

    const {
        emitter: logEmitter,
        isLoading: isStreamingLogs,
        disposable: disposeStreamingLogs,
    } = usePrebuildLogsEmitter(prebuildId, taskId);
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

    useEffect(() => {
        setLogNotFound(false);
        const disposable = watchPrebuild(prebuildId, (prebuild) => {
            if (currentPrebuild?.status?.phase?.name === PrebuildPhase_Phase.ABORTED) {
                disposeStreamingLogs?.dispose();
            }
            setCurrentPrebuild(prebuild);
        });

        return () => {
            disposable.dispose();
        };
    }, [prebuildId, disposeStreamingLogs, currentPrebuild?.status?.phase?.name]);

    useEffect(() => {
        const anyLogAvailable = currentPrebuild?.status?.taskLogs.some((t) => t.logUrl);
        if (!anyLogAvailable) {
            setLogNotFound(true);
        }
    }, [currentPrebuild?.status?.taskLogs]);

    useEffect(() => {
        history.listen(() => {
            dismissToast(PersistedToastID);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const notFoundError = error instanceof ApplicationError && error.code === ErrorCodes.NOT_FOUND;

    useEffect(() => {
        logEmitter.on("error", (err: Error) => {
            if (err?.name === "AbortError") {
                return;
            }
            if (err instanceof ApplicationError && err.code === ErrorCodes.NOT_FOUND) {
                // We don't want to show a toast for this error, because it's handled by `notFoundError`.
                return;
            }
            if (err?.message) {
                toast("Fetching logs failed: " + err.message);
            }
        });
        logEmitter.on("logs-error", (err: ApplicationError) => {
            if (err.code === ErrorCodes.NOT_FOUND) {
                setLogNotFound(true);
                return;
            }

            toast("Fetching logs failed: " + err.message, { autoHide: false, id: PersistedToastID });
        });
    }, [logEmitter, toast]);

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

    const prebuildPhase = useMemo(() => {
        const loaderIcon = <Loader2Icon size={20} className="text-gray-500 animate-spin" />;

        if (!currentPrebuild) {
            return {
                icon: loaderIcon,
                description: "",
            };
        }

        if (!currentPrebuild.status?.phase?.name) {
            return {
                icon: <CircleSlash size={20} className="text-gray-500" />,
                description: "Unknown prebuild status.",
            };
        }

        const props = prebuildDisplayProps(currentPrebuild);
        const Icon = prebuildStatusIconComponent(currentPrebuild);

        return {
            description: props.label,
            icon: <Icon className={props.className} />,
        };
    }, [currentPrebuild]);

    if (newPrebuildID) {
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
                                <div className="py-4 flex flex-col gap-1">
                                    <div className="px-6 flex gap-1 items-center">
                                        {prebuildPhase.icon}
                                        <span className="capitalize">{prebuildPhase.description}</span>{" "}
                                        {isStreamingLogs && (
                                            <TextMuted>
                                                <MiddleDot /> Fetching logs...
                                            </TextMuted>
                                        )}
                                    </div>
                                    {prebuild.status?.message && (
                                        <div className="px-6 text-pk-content-secondary truncate">
                                            {prebuild.status.message}
                                        </div>
                                    )}
                                </div>
                                {(currentPrebuild?.status?.taskLogs.some((t) => t.logUrl) || logNotFound) && (
                                    <Tabs
                                        value={taskId}
                                        onValueChange={setSelectedTaskId}
                                        className="p-0 bg-pk-surface-primary"
                                    >
                                        <TabsList className="overflow-x-auto max-w-full p-0 h-auto items-end">
                                            {currentPrebuild?.status?.taskLogs
                                                .filter((t) => t.logUrl)
                                                .map((task) => (
                                                    <TabsTrigger
                                                        value={task.taskId}
                                                        key={task.taskId}
                                                        className="font-normal text-base pt-2 px-4 rounded-t-lg border border-pk-border-base border-b-0 border-l-0 data-[state=active]:bg-pk-surface-secondary data-[state=active]:z-10 data-[state=active]:relative last:mr-1"
                                                    >
                                                        {task.taskLabel}
                                                    </TabsTrigger>
                                                ))}
                                        </TabsList>
                                        <TabsContent value={taskId} className="h-112 mt-0 border-pk-border-base">
                                            <Suspense fallback={<div />}>
                                                {logNotFound ? (
                                                    <div className="px-6 py-4 h-full w-full bg-pk-surface-primary text-base flex items-center justify-center">
                                                        <Text className="w-80 text-center">
                                                            Logs of this prebuild are inaccessible. Use{" "}
                                                            <code>gp validate --prebuild --headless</code> in a
                                                            workspace to see logs and debug prebuild issues.{" "}
                                                            <a
                                                                href="https://www.gitpod.io/docs/configure/workspaces#validate-your-gitpod-configuration"
                                                                target="_blank"
                                                                rel="noreferrer noopener"
                                                                className="gp-link"
                                                            >
                                                                Learn more
                                                            </a>
                                                            .
                                                        </Text>
                                                    </div>
                                                ) : (
                                                    <WorkspaceLogs
                                                        classes="h-full w-full"
                                                        xtermClasses="absolute top-0 left-0 bottom-0 right-0 ml-6 my-0 mt-4"
                                                        logsEmitter={logEmitter}
                                                        key={taskId}
                                                    />
                                                )}
                                            </Suspense>
                                        </TabsContent>
                                    </Tabs>
                                )}
                            </div>
                            <div className="px-6 pt-6 flex justify-between border-pk-border-base">
                                {[PrebuildPhase_Phase.BUILDING, PrebuildPhase_Phase.QUEUED].includes(
                                    currentPrebuild?.status?.phase?.name ?? PrebuildPhase_Phase.UNSPECIFIED,
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
                                <LinkButton
                                    disabled={!prebuild?.id}
                                    href={repositoriesRoutes.PrebuildsSettings(prebuild.configurationId)}
                                    variant="secondary"
                                >
                                    View Prebuild Settings
                                </LinkButton>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceType } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ListUsageRequest, Ordering, Usage, WorkspaceInstanceUsageData } from "@gitpod/gitpod-protocol/lib/usage";
import dayjs, { Dayjs } from "dayjs";
import { FC, forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useLocation } from "react-router";
import Header from "../components/Header";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import { useListUsage } from "../data/usage/usage-query";
import { useWorkspaceClasses } from "../data/workspaces/workspace-classes-query";
import Spinner from "../icons/Spinner.svg";
import { ReactComponent as UsageIcon } from "../images/usage-default.svg";
import Pagination from "../Pagination/Pagination";
import { toRemoteURL } from "../projects/render-utils";
import { gitpodHostUrl } from "../service/service";
import "./react-datepicker.css";
import { Heading2, Subheading } from "./typography/headings";
import { DownloadUsage } from "../usage/download/DownloadUsage";
import { useFeatureFlag } from "../data/featureflag-query";
import ContextMenu, { ContextMenuEntry } from "./ContextMenu";
import classNames from "classnames";

interface UsageViewProps {
    attributionId: AttributionId;
}

function UsageView({ attributionId }: UsageViewProps) {
    const [page, setPage] = useState(1);
    const [errorMessage, setErrorMessage] = useState("");
    const startOfCurrentMonth = dayjs().startOf("month");
    const [startDate, setStartDate] = useState(startOfCurrentMonth);
    const [endDate, setEndDate] = useState(dayjs());
    const supportedClasses = useWorkspaceClasses();
    const location = useLocation();
    const usageDownload = useFeatureFlag("usageDownload");

    useEffect(() => {
        const match = /#(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})/.exec(location.hash);
        if (match) {
            try {
                setStartDate(dayjs(match[1], "YYYY-MM-DD"));
                setEndDate(dayjs(match[2], "YYYY-MM-DD"));
            } catch (e) {
                console.error(e);
            }
        }
    }, [location]);
    const request = useMemo(() => {
        const request: ListUsageRequest = {
            attributionId: AttributionId.render(attributionId),
            from: startDate.startOf("day").valueOf(),
            to: endDate.endOf("day").valueOf(),
            order: Ordering.ORDERING_DESCENDING,
            pagination: {
                perPage: 50,
                page,
            },
        };
        return request;
    }, [attributionId, endDate, page, startDate]);
    const usagePage = useListUsage(request);

    if (usagePage.error) {
        if ((usagePage.error as any).code === ErrorCodes.PERMISSION_DENIED) {
            setErrorMessage("Access to usage details is restricted to team owners.");
        } else {
            setErrorMessage(`Error: ${usagePage.error?.message}`);
        }
    }

    useEffect(() => {
        if (startDate.isAfter(endDate)) {
            setErrorMessage("The start date needs to be before the end date.");
            return;
        }
        if (startDate.add(300, "day").isBefore(endDate)) {
            setErrorMessage("Range is too long. Max range is 300 days.");
            return;
        }
        setErrorMessage("");
        setPage(1);
    }, [startDate, endDate, setPage]);

    const getType = (type: WorkspaceType) => {
        if (type === "regular") {
            return "Workspace";
        }
        return "Prebuild";
    };

    const getDisplayName = (workspaceClass: string) => {
        const workspaceDisplayName = supportedClasses.data?.find((wc) => wc.id === workspaceClass)?.displayName;
        if (!workspaceDisplayName) {
            return workspaceClass;
        }
        return workspaceDisplayName;
    };

    const isRunning = (usage: Usage) => {
        if (usage.kind !== "workspaceinstance") {
            return false;
        }
        const metaData = usage.metadata as WorkspaceInstanceUsageData;
        return metaData.endTime === "" || metaData.endTime === undefined;
    };

    const getMinutes = (usage: Usage) => {
        if (usage.kind !== "workspaceinstance") {
            return "";
        }
        const metaData = usage.metadata as WorkspaceInstanceUsageData;
        const end = metaData.endTime ? new Date(metaData.endTime).getTime() : Date.now();
        const start = new Date(metaData.startTime).getTime();
        const lengthOfUsage = Math.floor(end - start);
        const inMinutes = (lengthOfUsage / (1000 * 60)).toFixed(1);
        return inMinutes + " min";
    };

    const displayTime = (time: string | number) => {
        const options: Intl.DateTimeFormatOptions = {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
        };
        return new Date(time).toLocaleDateString(undefined, options).replace("at ", "");
    };

    const currentPaginatedResults =
        usagePage.data?.usageEntriesList.filter((u) => u.kind === "workspaceinstance") ?? [];

    return (
        <>
            <Header title="Usage" subtitle="updated every 15 minutes" />
            <div className="app-container pt-5">
                {usageDownload && (
                    <div className="flex justify-end mb-4">
                        <DownloadUsage attributionId={attributionId} startDate={startDate} endDate={endDate} />
                    </div>
                )}
                {errorMessage && <p className="text-base">{errorMessage}</p>}

                <UsageToolbar
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                />

                <UsageSummaryData creditsUsed={usagePage.data?.creditsUsed} isLoading={usagePage.isLoading} />

                <div className="flex flex-col w-full mb-8">
                    <ItemsList className="mt-2 text-gray-400 dark:text-gray-500">
                        <Item header={false} className="grid grid-cols-12 gap-x-3 bg-gray-100 dark:bg-gray-800">
                            <ItemField className="col-span-2 my-auto ">
                                <span>Type</span>
                            </ItemField>
                            <ItemField className="col-span-5 my-auto">
                                <span>ID</span>
                            </ItemField>
                            <ItemField className="my-auto">
                                <span>Credits</span>
                            </ItemField>
                            <ItemField className="my-auto" />
                            <ItemField className="my-auto">
                                <span>Timestamp</span>
                            </ItemField>
                        </Item>

                        {/* results loading */}
                        {usagePage.isLoading && (
                            <div className="flex items-center justify-center w-full space-x-2 text-gray-400 text-sm pt-16 pb-40">
                                <img alt="Loading Spinner" className="h-4 w-4 animate-spin" src={Spinner} />
                                <span>Loading usage...</span>
                            </div>
                        )}

                        {/* results */}
                        {!usagePage.isLoading &&
                            currentPaginatedResults &&
                            currentPaginatedResults.map((usage) => {
                                return (
                                    <div
                                        key={usage.workspaceInstanceId}
                                        className="flex p-3 grid grid-cols-12 gap-x-3 justify-between transition ease-in-out rounded-xl"
                                    >
                                        <div className="flex flex-col col-span-2 my-auto">
                                            <span className="text-gray-600 dark:text-gray-100 text-md font-medium">
                                                {getType((usage.metadata as WorkspaceInstanceUsageData).workspaceType)}
                                            </span>
                                            <span className="text-sm text-gray-400 dark:text-gray-500">
                                                {getDisplayName(
                                                    (usage.metadata as WorkspaceInstanceUsageData).workspaceClass,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex flex-col col-span-5 my-auto">
                                            <div className="flex">
                                                {isRunning(usage) && (
                                                    <div
                                                        className="rounded-full w-2 h-2 text-sm align-middle bg-green-500 my-auto mx-1"
                                                        title="Still running"
                                                    />
                                                )}
                                                <span className="truncate text-gray-600 dark:text-gray-100 text-md font-medium">
                                                    {(usage.metadata as WorkspaceInstanceUsageData).workspaceId}
                                                </span>
                                            </div>
                                            <span className="text-sm truncate text-gray-400 dark:text-gray-500">
                                                {(usage.metadata as WorkspaceInstanceUsageData).contextURL &&
                                                    toRemoteURL(
                                                        (usage.metadata as WorkspaceInstanceUsageData).contextURL,
                                                    )}
                                            </span>
                                        </div>
                                        <div className="flex flex-col my-auto">
                                            <span className="text-right text-gray-500 dark:text-gray-400 font-medium">
                                                {usage.credits}
                                            </span>
                                            <span className="text-right text-sm text-gray-400 dark:text-gray-500">
                                                {getMinutes(usage)}
                                            </span>
                                        </div>
                                        <div className="my-auto" />
                                        <div className="flex flex-col col-span-3 my-auto">
                                            <span className="text-gray-400 dark:text-gray-500 truncate font-medium">
                                                {displayTime(usage.effectiveTime!)}
                                            </span>
                                            <div className="flex">
                                                {(usage.metadata as WorkspaceInstanceUsageData).workspaceType ===
                                                "prebuild" ? (
                                                    <UsageIcon className="my-auto w-4 h-4 mr-1" />
                                                ) : (
                                                    ""
                                                )}
                                                {(usage.metadata as WorkspaceInstanceUsageData).workspaceType ===
                                                "prebuild" ? (
                                                    <span className="text-sm text-gray-400 dark:text-gray-500">
                                                        Gitpod
                                                    </span>
                                                ) : (
                                                    <div className="flex">
                                                        <img
                                                            className="my-auto rounded-full w-4 h-4 inline-block align-text-bottom mr-1 overflow-hidden"
                                                            src={
                                                                (usage.metadata as WorkspaceInstanceUsageData)
                                                                    .userAvatarURL || ""
                                                            }
                                                            alt="user avatar"
                                                        />
                                                        <span className="text-sm text-gray-400 dark:text-gray-500">
                                                            {(usage.metadata as WorkspaceInstanceUsageData).userName ||
                                                                ""}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                        {/* No results */}
                        {!usagePage.isLoading && currentPaginatedResults.length === 0 && !errorMessage && (
                            <div className="flex flex-col w-full mb-8">
                                <Heading2 className="text-center mt-8">No sessions found.</Heading2>
                                <Subheading className="text-center mt-1">
                                    Have you started any
                                    <a className="gp-link" href={gitpodHostUrl.asWorkspacePage().toString()}>
                                        {" "}
                                        workspaces
                                    </a>{" "}
                                    in {startDate.format("MMMM YYYY")} or checked your other organizations?
                                </Subheading>
                            </div>
                        )}
                    </ItemsList>

                    {usagePage.data && usagePage.data.pagination && usagePage.data.pagination.totalPages > 1 && (
                        <Pagination
                            currentPage={usagePage.data.pagination.page}
                            setPage={setPage}
                            totalNumberOfPages={usagePage.data.pagination.totalPages}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

export default UsageView;

// TODO: move these into the `/usage` folder once the export as csv feature is merged into this
type UsageToolbarProps = {
    startDate: Dayjs;
    endDate: Dayjs;
    onStartDateChange: (val: Dayjs) => void;
    onEndDateChange: (val: Dayjs) => void;
};
const UsageToolbar: FC<UsageToolbarProps> = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
    const handleRangeChanged = useCallback(
        (start: Dayjs, end: Dayjs) => {
            onStartDateChange(start);
            onEndDateChange(end);
        },
        [onEndDateChange, onStartDateChange],
    );

    return (
        <div
            className={classNames(
                "flex items-start flex-col space-y-3 px-3",
                "sm:flex-row sm:items-center sm:space-x-3 sm:space-y-0",
            )}
        >
            <UsageDateRangePicker onChange={handleRangeChanged} />
            <div className="flex items-center space-x-3">
                <DatePicker
                    selected={startDate.toDate()}
                    onChange={(date) => date && onStartDateChange(dayjs(date))}
                    selectsStart
                    startDate={startDate.toDate()}
                    endDate={endDate.toDate()}
                    maxDate={endDate.toDate()}
                    customInput={<DateDisplay />}
                    dateFormat={"MMM d, yyyy"}
                    // tab loop enabled causes a bug w/ layout shift to the right of input when open
                    enableTabLoop={false}
                />
                <Subheading>to</Subheading>
                <DatePicker
                    selected={endDate.toDate()}
                    onChange={(date) => date && onEndDateChange(dayjs(date))}
                    selectsEnd
                    startDate={startDate.toDate()}
                    endDate={endDate.toDate()}
                    minDate={startDate.toDate()}
                    customInput={<DateDisplay />}
                    dateFormat={"MMM d, yyyy"}
                    enableTabLoop={false}
                />
            </div>
        </div>
    );
};

const DateDisplay = forwardRef((arg: any, ref: any) => (
    <div
        className="px-2 py-0.5 text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800 rounded-md cursor-pointer flex items-center hover:bg-gray-100 dark:hover:bg-gray-700"
        onClick={arg.onClick}
        ref={ref}
    >
        <div className="w-28 font-medium">{arg.value}</div>
        <div>
            <svg
                width="20"
                height="20"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                onClick={arg.onClick}
                ref={ref}
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
                />
                <title>Change Date</title>
            </svg>
        </div>
    </div>
));

type UsageDateRangePickerProps = {
    onChange: (start: dayjs.Dayjs, end: dayjs.Dayjs) => void;
};
const UsageDateRangePicker: FC<UsageDateRangePickerProps> = ({ onChange }) => {
    const entries = useMemo<ContextMenuEntry[]>(() => {
        const startOfCurrentMonth = dayjs().startOf("month");

        const entries: ContextMenuEntry[] = [
            {
                title: "Current month",
                onClick: () => onChange(startOfCurrentMonth, dayjs()),
                active: false,
            },
        ];

        // This goes back 6 months from the current month
        for (let i = 1; i < 7; i++) {
            const startDate = dayjs().subtract(i, "month").startOf("month");
            const endDate = startDate.endOf("month");
            entries.push({
                title: startDate.format("MMMM YYYY"),
                active: false,
                onClick: () => onChange(startDate, endDate),
            });
        }

        return entries;
    }, [onChange]);

    return (
        <ContextMenu menuEntries={entries} customClasses="left-0">
            <DateDisplay value="Date Range" onClick={noop} />
        </ContextMenu>
    );
};

type UsageSummaryDataProps = {
    isLoading: boolean;
    creditsUsed?: number;
};
const UsageSummaryData: FC<UsageSummaryDataProps> = ({ isLoading, creditsUsed }) => {
    return (
        <div className="mt-8 p-3 flex flex-col">
            <Subheading>Credits Consumed</Subheading>
            <div className="flex text-lg text-gray-600 font-semibold">
                <span className="dark:text-gray-400">
                    {creditsUsed !== undefined ? creditsUsed.toLocaleString() : "-"}
                </span>
            </div>
        </div>
    );
};

const noop = () => {};

// TODO: figure out where to put this link
// {
//     currentOrg.data && currentOrg.data.isOwner && (
//         <div className="flex text-xs text-gray-600">
//             <span className="dark:text-gray-500 text-gray-400">
//                 <Link to="/billing" className="gp-link">
//                     View Billing →
//                 </Link>
//             </span>
//         </div>
//     );
// }

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import {
    BillableSessionRequest,
    BillableWorkspaceType,
    ExtendedBillableSession,
    SortOrder,
} from "@gitpod/gitpod-protocol/lib/usage";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import Pagination from "../Pagination/Pagination";
import Header from "../components/Header";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ReactComponent as CreditsSvg } from "../images/credits.svg";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import { ReactComponent as SortArrow } from "../images/sort-arrow.svg";
import { ReactComponent as UsageIcon } from "../images/usage-default.svg";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { toRemoteURL } from "../projects/render-utils";

function TeamUsage() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [teamBillingMode, setTeamBillingMode] = useState<BillingMode | undefined>(undefined);
    const [billedUsage, setBilledUsage] = useState<ExtendedBillableSession[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [resultsPerPage] = useState(50);
    const [errorMessage, setErrorMessage] = useState("");
    const today = new Date();
    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const timestampStartOfCurrentMonth = startOfCurrentMonth.getTime();
    const [startDateOfBillMonth, setStartDateOfBillMonth] = useState(timestampStartOfCurrentMonth);
    const [endDateOfBillMonth, setEndDateOfBillMonth] = useState(Date.now());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isStartedTimeDescending, setIsStartedTimeDescending] = useState<boolean>(true);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const teamBillingMode = await getGitpodService().server.getBillingModeForTeam(team.id);
            setTeamBillingMode(teamBillingMode);
        })();
    }, [team]);

    useEffect(() => {
        if (!team) {
            return;
        }
        if (billedUsage.length === 0) {
            setIsLoading(true);
        }
        (async () => {
            const attributionId = AttributionId.render({ kind: "team", teamId: team.id });
            const request: BillableSessionRequest = {
                attributionId,
                startedTimeOrder: isStartedTimeDescending ? SortOrder.Descending : SortOrder.Ascending,
                from: startDateOfBillMonth,
                to: endDateOfBillMonth,
            };
            try {
                const { server } = getGitpodService();
                const billedUsageResult = await server.listBilledUsage(request);
                setBilledUsage(billedUsageResult);
            } catch (error) {
                if (error.code === ErrorCodes.PERMISSION_DENIED) {
                    setErrorMessage("Access to usage details is restricted to team owners.");
                }
            } finally {
                setIsLoading(false);
            }
        })();
    }, [team, startDateOfBillMonth, endDateOfBillMonth, isStartedTimeDescending]);

    useEffect(() => {
        if (!teamBillingMode) {
            return;
        }
        if (!BillingMode.showUsageBasedBilling(teamBillingMode)) {
            window.location.href = gitpodHostUrl.asDashboard().toString();
        }
    }, [teamBillingMode]);

    const getType = (type: BillableWorkspaceType) => {
        if (type === "regular") {
            return "Workspace";
        }
        return "Prebuild";
    };

    const getMinutes = (usage: ExtendedBillableSession) => {
        let end;
        if (!usage.endTime) {
            end = new Date(Date.now()).getTime();
        } else {
            end = new Date(usage.endTime).getTime();
        }
        const start = new Date(usage.startTime).getTime();
        const lengthOfUsage = Math.floor(end - start);
        const inMinutes = (lengthOfUsage / (1000 * 60)).toFixed(1);
        return inMinutes + " min";
    };

    const calculateTotalUsage = () => {
        let totalCredits = 0;
        billedUsage.forEach((session) => (totalCredits += session.credits));
        return totalCredits.toFixed(2);
    };

    const handleMonthClick = (start: any, end: any) => {
        setStartDateOfBillMonth(start);
        setEndDateOfBillMonth(end);
    };

    const getBillingHistory = () => {
        let rows = [];
        // This goes back 6 months from the current month
        for (let i = 1; i < 7; i++) {
            const endDateVar = i - 1;
            const startDate = new Date(today.getFullYear(), today.getMonth() - i);
            const endDate = new Date(today.getFullYear(), today.getMonth() - endDateVar, 0);
            const timeStampOfStartDate = startDate.getTime();
            const timeStampOfEndDate = endDate.getTime();
            rows.push(
                <div
                    key={`billing${i}`}
                    className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-500 truncate cursor-pointer gp-link"
                    onClick={() => handleMonthClick(timeStampOfStartDate, timeStampOfEndDate)}
                >
                    {startDate.toLocaleString("default", { month: "long" })} {startDate.getFullYear()}
                </div>,
            );
        }
        return rows;
    };

    const displayTime = (time: string) => {
        const options: Intl.DateTimeFormatOptions = {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
        };
        return new Date(time).toLocaleDateString(undefined, options).replace("at ", "");
    };

    const lastResultOnCurrentPage = currentPage * resultsPerPage;
    const firstResultOnCurrentPage = lastResultOnCurrentPage - resultsPerPage;
    const totalNumberOfPages = Math.ceil(billedUsage.length / resultsPerPage);
    const currentPaginatedResults = billedUsage.slice(firstResultOnCurrentPage, lastResultOnCurrentPage);

    return (
        <>
            <Header title="Usage" subtitle="Manage team usage." />
            <div className="app-container pt-5">
                {errorMessage && <p className="text-base">{errorMessage}</p>}
                {!errorMessage && (
                    <div className="flex space-x-16">
                        <div className="flex">
                            <div className="space-y-8 mb-6" style={{ width: "max-content" }}>
                                <div className="flex flex-col truncate">
                                    <div className="text-base text-gray-500 truncate">Current Month</div>
                                    <div
                                        className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-500 truncate cursor-pointer mb-5"
                                        onClick={() => handleMonthClick(timestampStartOfCurrentMonth, Date.now())}
                                    >
                                        {startOfCurrentMonth.toLocaleString("default", { month: "long" })}{" "}
                                        {startOfCurrentMonth.getFullYear()}
                                    </div>
                                    <div className="text-base text-gray-500 truncate">Previous Months</div>
                                    {getBillingHistory()}
                                </div>
                                <div className="flex flex-col truncate">
                                    <div className="text-base text-gray-500">Total usage</div>
                                    <div className="flex text-lg text-gray-600 font-semibold">
                                        <CreditsSvg className="my-auto mr-1" />
                                        <span>{calculateTotalUsage()} Credits</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {!isLoading && billedUsage.length === 0 && !errorMessage && (
                            <div className="flex flex-col w-full mb-8">
                                <h3 className="text-center text-gray-500 mt-8">No sessions found.</h3>
                                <p className="text-center text-gray-500 mt-1">
                                    Have you started any
                                    <a className="gp-link" href={gitpodHostUrl.asWorkspacePage().toString()}>
                                        {" "}
                                        workspaces
                                    </a>{" "}
                                    in{" "}
                                    {new Date(startDateOfBillMonth).toLocaleString("default", {
                                        month: "long",
                                    })}{" "}
                                    {new Date(startDateOfBillMonth).getFullYear()} or checked your other teams?
                                </p>
                            </div>
                        )}
                        {isLoading && (
                            <div className="flex flex-col place-items-center align-center w-full">
                                <div className="uppercase text-sm text-gray-400 dark:text-gray-500 mb-5">
                                    Fetching usage...
                                </div>
                                <Spinner className="m-2 h-5 w-5 animate-spin" />
                            </div>
                        )}
                        {billedUsage.length > 0 && !isLoading && (
                            <div className="flex flex-col w-full mb-8">
                                <ItemsList className="mt-2 text-gray-400 dark:text-gray-500">
                                    <Item
                                        header={false}
                                        className="grid grid-cols-12 gap-x-3 bg-gray-100 dark:bg-gray-800"
                                    >
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
                                        <ItemField className="col-span-3 my-auto cursor-pointer">
                                            <span
                                                className="flex my-auto"
                                                onClick={() => setIsStartedTimeDescending(!isStartedTimeDescending)}
                                            >
                                                Timestamp
                                                <SortArrow
                                                    className={`ml-1 h-4 w-4 my-auto ${
                                                        isStartedTimeDescending ? "" : " transform rotate-180"
                                                    }`}
                                                />
                                            </span>
                                        </ItemField>
                                    </Item>
                                    {currentPaginatedResults &&
                                        currentPaginatedResults.map((usage) => {
                                            return (
                                                <div
                                                    key={usage.instanceId}
                                                    className="flex p-3 grid grid-cols-12 gap-x-3 justify-between transition ease-in-out rounded-xl"
                                                >
                                                    <div className="flex flex-col col-span-2 my-auto">
                                                        <span className="text-gray-600 dark:text-gray-100 text-md font-medium">
                                                            {getType(usage.workspaceType)}
                                                        </span>
                                                        <span className="text-sm text-gray-400 dark:text-gray-500">
                                                            {usage.workspaceClass}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col col-span-5 my-auto">
                                                        <span className="truncate text-gray-600 dark:text-gray-100 text-md font-medium">
                                                            {usage.workspaceId}
                                                        </span>
                                                        <span className="text-sm truncate text-gray-400 dark:text-gray-500">
                                                            {usage.contextURL && toRemoteURL(usage.contextURL)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col my-auto">
                                                        <span className="text-right text-gray-500 dark:text-gray-400 font-medium">
                                                            {usage.credits.toFixed(1)}
                                                        </span>
                                                        <span className="text-right truncate text-sm text-gray-400 dark:text-gray-500">
                                                            {getMinutes(usage)}
                                                        </span>
                                                    </div>
                                                    <div className="my-auto" />
                                                    <div className="flex flex-col col-span-3 my-auto">
                                                        <span className="text-gray-400 dark:text-gray-500 truncate font-medium">
                                                            {displayTime(usage.startTime)}
                                                        </span>
                                                        <div className="flex">
                                                            {usage.workspaceType === "prebuild" ? (
                                                                <UsageIcon className="my-auto w-4 h-4 mr-1" />
                                                            ) : (
                                                                ""
                                                            )}
                                                            {usage.workspaceType === "prebuild" ? (
                                                                <span className="text-sm text-gray-400 dark:text-gray-500">
                                                                    Gitpod
                                                                </span>
                                                            ) : (
                                                                <div className="flex">
                                                                    <img
                                                                        className="my-auto rounded-full w-4 h-4 inline-block align-text-bottom mr-1 overflow-hidden"
                                                                        src={usage.user?.avatarURL || ""}
                                                                        alt="user avatar"
                                                                    />
                                                                    <span className="text-sm text-gray-400 dark:text-gray-500">
                                                                        {usage.user?.name}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </ItemsList>
                                {billedUsage.length > resultsPerPage && (
                                    <Pagination
                                        totalResults={billedUsage.length}
                                        currentPage={currentPage}
                                        setCurrentPage={setCurrentPage}
                                        totalNumberOfPages={totalNumberOfPages}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

export default TeamUsage;

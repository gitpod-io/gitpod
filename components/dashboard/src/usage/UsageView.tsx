/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Ordering } from "@gitpod/gitpod-protocol/lib/usage";
import dayjs, { Dayjs } from "dayjs";
import { FC, useCallback, useMemo } from "react";
import { useHistory, useLocation } from "react-router";
import Header from "../components/Header";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import { useListUsage } from "../data/usage/usage-query";
import Spinner from "../icons/Spinner.svg";
import Pagination from "../Pagination/Pagination";
import { gitpodHostUrl } from "../service/service";
import { Heading2, Subheading } from "../components/typography/headings";
import { UsageSummaryData } from "./UsageSummary";
import { UsageEntry } from "./UsageEntry";
import Alert from "../components/Alert";
import classNames from "classnames";
import { UsageDateFilters } from "./UsageDateFilters";
import { DownloadUsage } from "./download/DownloadUsage";
import { useQueryParams } from "../hooks/use-query-params";

const DATE_PARAM_FORMAT = "YYYY-MM-DD";

interface UsageViewProps {
    attributionId: AttributionId;
}

export const UsageView: FC<UsageViewProps> = ({ attributionId }) => {
    const location = useLocation();
    const history = useHistory();
    const params = useQueryParams();

    // page filter params are all in the url as querystring params
    const startOfCurrentMonth = dayjs().startOf("month");
    const startDate = getDateFromParam(params.get("start")) || startOfCurrentMonth;
    const endDate = getDateFromParam(params.get("end")) || dayjs();
    const page = getNumberFromParam(params.get("page")) || 1;

    const usagePage = useListUsage({
        attributionId: AttributionId.render(attributionId),
        from: startDate.startOf("day").valueOf(),
        to: endDate.endOf("day").valueOf(),
        order: Ordering.ORDERING_DESCENDING,
        pagination: {
            perPage: 50,
            page,
        },
    });

    // Updates the query params w/ new values overlaid onto existing values
    const updatePageParams = useCallback(
        (pageParams: { start?: Dayjs; end?: Dayjs; page?: number }) => {
            const newParams = new URLSearchParams(params);
            newParams.set("start", (pageParams.start || startDate).format(DATE_PARAM_FORMAT));
            newParams.set("end", (pageParams.end || endDate).format(DATE_PARAM_FORMAT));
            newParams.set("page", `${pageParams.page || page}`);

            history.push(`${location.pathname}?${newParams}`);
        },
        [endDate, history, location.pathname, page, params, startDate],
    );

    const handlePageChange = useCallback(
        (val: number) => {
            updatePageParams({ page: val });
        },
        [updatePageParams],
    );

    const errorMessage = useMemo(() => {
        let errorMessage = "";

        if (usagePage.error) {
            if ((usagePage.error as any).code === ErrorCodes.PERMISSION_DENIED) {
                errorMessage = "Access to usage details is restricted to team owners.";
            } else {
                errorMessage = `${usagePage.error?.message}`;
            }
        }

        return errorMessage;
    }, [usagePage.error]);

    const usageEntries = usagePage.data?.usageEntriesList ?? [];

    const readableSchedulerDuration = useMemo(() => {
        const intervalMinutes = usagePage.data?.ledgerIntervalMinutes;
        if (!intervalMinutes) {
            return "";
        }

        return `${intervalMinutes} minute${intervalMinutes !== 1 ? "s" : ""}`;
    }, [usagePage.data]);

    return (
        <>
            <Header
                title="Usage"
                subtitle={
                    "Organization usage" +
                    (readableSchedulerDuration ? ", updated every " + readableSchedulerDuration : "") +
                    "."
                }
            />
            <div className="app-container pt-5">
                <div
                    className={classNames(
                        "flex flex-col items-start space-y-3 justify-between px-3",
                        "md:flex-row md:items-center md:space-x-4 md:space-y-0",
                    )}
                >
                    <UsageDateFilters startDate={startDate} endDate={endDate} onDateRangeChange={updatePageParams} />
                    <DownloadUsage attributionId={attributionId} startDate={startDate} endDate={endDate} />
                </div>

                {errorMessage && (
                    <Alert type="error" className="mt-4">
                        {errorMessage}
                    </Alert>
                )}

                <UsageSummaryData creditsUsed={usagePage.data?.creditsUsed} />

                <div className="flex flex-col w-full mb-8">
                    <ItemsList className="mt-2 text-gray-400 dark:text-gray-500">
                        <Item header={false} className="grid grid-cols-12 gap-x-3 bg-pk-surface-secondary">
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
                            usageEntries.map((usage) => {
                                return <UsageEntry key={usage.id} usage={usage} />;
                            })}

                        {/* No results */}
                        {!usagePage.isLoading && usageEntries.length === 0 && !errorMessage && (
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
                            setPage={handlePageChange}
                            totalNumberOfPages={usagePage.data.pagination.totalPages}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

const getDateFromParam = (paramValue: string | null) => {
    if (!paramValue) {
        return null;
    }

    try {
        const date = dayjs(paramValue, DATE_PARAM_FORMAT, true);
        if (!date.isValid()) {
            return null;
        }

        return date;
    } catch (e) {
        return null;
    }
};

const getNumberFromParam = (paramValue: string | null) => {
    if (!paramValue) {
        return null;
    }

    try {
        const number = Number.parseInt(paramValue, 10);
        if (Number.isNaN(number)) {
            return null;
        }

        return number;
    } catch (e) {
        return null;
    }
};

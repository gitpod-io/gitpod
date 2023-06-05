/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Ordering } from "@gitpod/gitpod-protocol/lib/usage";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
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
import { useFeatureFlag } from "../data/featureflag-query";
import { DownloadUsage } from "./download/DownloadUsage";

interface UsageViewProps {
    attributionId: AttributionId;
}

function UsageView({ attributionId }: UsageViewProps) {
    const [page, setPage] = useState(1);
    const startOfCurrentMonth = dayjs().startOf("month");
    const [startDate, setStartDate] = useState(startOfCurrentMonth);
    const [endDate, setEndDate] = useState(dayjs());
    const location = useLocation();
    const usageDownload = useFeatureFlag("usageDownload");

    // parse out optional dates from url hash
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

    // reset to page 1 when dates change
    useEffect(() => {
        setPage(1);
    }, [startDate, endDate]);

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

    let errorMessage = useMemo(() => {
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

    const currentPaginatedResults =
        usagePage.data?.usageEntriesList.filter((u) => u.kind === "workspaceinstance") ?? [];

    return (
        <>
            <Header title="Usage" subtitle="Organization usage, updated every 15 minutes." />
            <div className="app-container pt-5">
                <div
                    className={classNames(
                        "flex flex-col items-start space-y-3 justify-between px-3",
                        "md:flex-row md:items-center md:space-x-4 md:space-y-0",
                    )}
                >
                    <UsageDateFilters
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                    />
                    {usageDownload && (
                        <DownloadUsage attributionId={attributionId} startDate={startDate} endDate={endDate} />
                    )}
                </div>

                {errorMessage && (
                    <Alert type="error" className="mt-4">
                        {errorMessage}
                    </Alert>
                )}

                <UsageSummaryData creditsUsed={usagePage.data?.creditsUsed} />

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
                                return <UsageEntry key={usage.id} usage={usage} />;
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

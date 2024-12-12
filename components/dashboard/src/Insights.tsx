/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LoadingState } from "@podkit/loading/LoadingState";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import classNames from "classnames";
import { useCallback, useMemo, useState } from "react";
import { Accordion } from "./components/accordion/Accordion";
import Alert from "./components/Alert";
import Header from "./components/Header";
import { Item, ItemField, ItemsList } from "./components/ItemsList";
import { useWorkspaceSessions } from "./data/insights/list-workspace-sessions-query";
import { WorkspaceSessionGroup } from "./insights/WorkspaceSessionGroup";
import { gitpodHostUrl } from "./service/service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@podkit/select/Select";
import dayjs from "dayjs";
import { Timestamp } from "@bufbuild/protobuf";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { TextMuted } from "@podkit/typography/TextMuted";
import { DownloadInsightsToast } from "./insights/download/DownloadInsights";
import { useCurrentOrg } from "./data/organizations/orgs-query";
import { useToast } from "./components/toasts/Toasts";
import { useTemporaryState } from "./hooks/use-temporary-value";
import { DownloadIcon } from "lucide-react";
import { Button } from "@podkit/buttons/Button";

export const Insights = () => {
    const [prebuildsFilter, setPrebuildsFilter] = useState<"week" | "month" | "year">("week");
    const [upperBound, lowerBound] = useMemo(() => {
        const from = dayjs().subtract(1, prebuildsFilter).startOf("day");

        const fromTimestamp = Timestamp.fromDate(from.toDate());
        const toTimestamp = Timestamp.fromDate(new Date());
        return [fromTimestamp, toTimestamp];
    }, [prebuildsFilter]);
    const {
        data,
        error: errorMessage,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useWorkspaceSessions({
        from: upperBound,
        to: lowerBound,
    });

    const hasMoreThanOnePage = (data?.pages.length ?? 0) > 1;
    const sessions = useMemo(() => data?.pages.flatMap((p) => p) ?? [], [data]);
    const grouped = Object.groupBy(sessions, (ws) => ws.workspace?.id ?? "unknown");
    const [page, setPage] = useState(0);

    return (
        <>
            <Header title="Insights" subtitle="Insights into workspace sessions in your organization" />
            <div className="app-container pt-5">
                <div
                    className={classNames(
                        "flex flex-col items-start space-y-3 justify-between",
                        "md:flex-row md:items-center md:space-x-4 md:space-y-0",
                    )}
                >
                    <Select value={prebuildsFilter} onValueChange={(v) => setPrebuildsFilter(v as any)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select time range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">Last 7 days</SelectItem>
                            <SelectItem value="month">Last 30 days</SelectItem>
                            <SelectItem value="year">Last 365 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <DownloadUsage from={upperBound} to={lowerBound} />
                </div>

                <div
                    className={classNames(
                        "flex flex-col items-start space-y-3 justify-between px-3",
                        "md:flex-row md:items-center md:space-x-4 md:space-y-0",
                    )}
                ></div>

                {errorMessage && (
                    <Alert type="error" className="mt-4">
                        {errorMessage instanceof Error ? errorMessage.message : "An error occurred."}
                    </Alert>
                )}

                <div className="flex flex-col w-full mb-8">
                    <ItemsList className="mt-2 text-pk-content-secondary">
                        <Item header={false} className="grid grid-cols-12 gap-x-3 bg-pk-surface-tertiary">
                            <ItemField className="col-span-2 my-auto">
                                <span>Type</span>
                            </ItemField>
                            <ItemField className="col-span-5 my-auto">
                                <span>ID</span>
                            </ItemField>
                            <ItemField className="col-span-3 my-auto">
                                <span>User</span>
                            </ItemField>
                            <ItemField className="col-span-2 my-auto">
                                <span>Sessions</span>
                            </ItemField>
                        </Item>

                        {isLoading && (
                            <div className="flex items-center justify-center w-full space-x-2 text-pk-content-primary text-sm pt-16 pb-40">
                                <LoadingState />
                                <span>Loading usage...</span>
                            </div>
                        )}

                        {!isLoading && (
                            <Accordion type="multiple" className="w-full">
                                {Object.entries(grouped).map(([id, sessions]) => {
                                    if (!sessions?.length) {
                                        return null;
                                    }

                                    return <WorkspaceSessionGroup key={id} id={id} sessions={sessions} />;
                                })}
                            </Accordion>
                        )}

                        {/* No results */}
                        {!isLoading && sessions.length === 0 && !errorMessage && (
                            <div className="flex flex-col w-full mb-8">
                                <Heading2 className="text-center mt-8">No sessions found.</Heading2>
                                <Subheading className="text-center mt-1">
                                    Have you started any
                                    <a className="gp-link" href={gitpodHostUrl.asWorkspacePage().toString()}>
                                        {" "}
                                        workspaces
                                    </a>{" "}
                                    in the last 30 days or checked your other organizations?
                                </Subheading>
                            </div>
                        )}
                    </ItemsList>
                </div>

                <div className="mt-4 mb-8 flex flex-row justify-center">
                    {hasNextPage ? (
                        <LoadingButton
                            variant="secondary"
                            onClick={() => {
                                setPage(page + 1);
                                fetchNextPage();
                            }}
                            loading={isFetchingNextPage}
                        >
                            Load more
                        </LoadingButton>
                    ) : (
                        hasMoreThanOnePage && <TextMuted>All workspace sessions are loaded</TextMuted>
                    )}
                </div>
            </div>
        </>
    );
};

type DownloadUsageProps = {
    from: Timestamp;
    to: Timestamp;
};
export const DownloadUsage = ({ from, to }: DownloadUsageProps) => {
    const { data: org } = useCurrentOrg();
    const { toast } = useToast();
    // When we start the download, we disable the button for a short time
    const [downloadDisabled, setDownloadDisabled] = useTemporaryState(false, 1000);

    const handleDownload = useCallback(async () => {
        if (!org) {
            return;
        }

        setDownloadDisabled(true);
        toast(
            <DownloadInsightsToast
                organizationName={org?.slug ?? org?.id}
                organizationId={org.id}
                from={from}
                to={to}
            />,
            {
                autoHide: false,
            },
        );
    }, [org, setDownloadDisabled, toast, from, to]);

    return (
        <Button variant="secondary" onClick={handleDownload} className="gap-1" disabled={downloadDisabled}>
            <DownloadIcon strokeWidth={3} className="w-4" />
            <span>Export as CSV</span>
        </Button>
    );
};

export default Insights;

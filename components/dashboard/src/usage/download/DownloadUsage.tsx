/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { useDownloadUsageCSV } from "./download-usage-csv";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Dayjs } from "dayjs";
import { useToast } from "../../components/toasts/Toasts";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { ReactComponent as DownloadIcon } from "../../icons/Download.svg";
import StatusDoneIcon from "../../icons/StatusDone.svg";
import { ReactComponent as ExclamationIcon } from "../../images/exclamation.svg";
import { LinkButton } from "../../components/LinkButton";
import { saveAs } from "file-saver";
import prettyBytes from "pretty-bytes";
import { ProgressBar } from "../../components/ProgressBar";

type Props = {
    attributionId: AttributionId;
    startDate: Dayjs;
    endDate: Dayjs;
};
export const DownloadUsage: FC<Props> = ({ attributionId, startDate, endDate }) => {
    const { data: org } = useCurrentOrg();
    const { toast } = useToast();

    const handleDownload = useCallback(async () => {
        if (!org) {
            return;
        }

        toast(
            <DownloadUsageToast
                orgName={org?.slug ?? org?.id}
                attributionId={attributionId}
                startDate={startDate}
                endDate={endDate}
            />,
            {
                autoHide: false,
            },
        );
    }, [attributionId, endDate, org, startDate, toast]);

    return (
        <Button type="secondary" onClick={handleDownload} className="flex flex-row" icon={<DownloadIcon />}>
            Export as CSV
        </Button>
    );
};

type DownloadUsageToastProps = Props & {
    orgName: string;
};

const DownloadUsageToast: FC<DownloadUsageToastProps> = ({ attributionId, endDate, startDate, orgName }) => {
    const [progress, setProgress] = useState(0);

    const queryArgs = useMemo(
        () => ({
            orgName,
            attributionId: AttributionId.render(attributionId),
            from: startDate.startOf("day").valueOf(),
            to: endDate.endOf("day").valueOf(),
            onProgress: setProgress,
        }),
        [attributionId, endDate, orgName, startDate],
    );
    const { data, error, isLoading, abort, remove } = useDownloadUsageCSV(queryArgs);

    const saveFile = useCallback(() => {
        if (!data || !data.blob) {
            return;
        }

        saveAs(data.blob, data.filename);
    }, [data]);

    useEffect(() => {
        return () => {
            abort();
            remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-2">
                <div className="flex flex-row items-center space-x-2">
                    <span>Preparing usage export</span>
                </div>
                <ProgressBar percent={progress} />
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="flex flex-row items-start space-x-2">
                    <ExclamationIcon className="mt-1 w-4 h-4" />
                    <span>Error exporting your usage data:</span>
                </div>
                <pre className="mt-2 whitespace-normal text-sm">{error.message}</pre>
            </div>
        );
    }

    if (!data || !data.blob || data.count === 0) {
        return <span>There are no usage records for that date range</span>;
    }

    const readableSize = prettyBytes(data.blob.size);
    const formattedCount = Intl.NumberFormat().format(data.count);

    return (
        <div className="space-y-2">
            <div className="flex flex-row items-center justify-between space-x-2">
                <div className="flex flex-row items-center space-x-2">
                    <img src={StatusDoneIcon} className="w-5 h-5" alt="Completed icon" />
                    <span>Usage export complete.</span>
                </div>
                <LinkButton onClick={saveFile} className="text-left text-base">
                    Download CSV file
                </LinkButton>
            </div>
            <p>{`${readableSize} - ${formattedCount} entries exported`}</p>
        </div>
    );
};

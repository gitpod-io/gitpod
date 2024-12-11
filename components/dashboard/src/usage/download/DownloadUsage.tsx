/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useDownloadUsageCSV } from "./download-usage-csv";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Dayjs } from "dayjs";
import { useToast } from "../../components/toasts/Toasts";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { ReactComponent as DownloadIcon } from "../../icons/Download.svg";
import { ReactComponent as ExclamationIcon } from "../../images/exclamation.svg";
import { LinkButton } from "../../components/LinkButton";
import { saveAs } from "file-saver";
import prettyBytes from "pretty-bytes";
import { ProgressBar } from "../../components/ProgressBar";
import { useTemporaryState } from "../../hooks/use-temporary-value";
import { Button } from "@podkit/buttons/Button";

type Props = {
    attributionId: AttributionId;
    startDate: Dayjs;
    endDate: Dayjs;
};
export const DownloadUsage: FC<Props> = ({ attributionId, startDate, endDate }) => {
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
    }, [attributionId, endDate, org, setDownloadDisabled, startDate, toast]);

    return (
        // TODO: Convert this to use an IconButton when we add one to podkit
        <Button variant="secondary" onClick={handleDownload} className="gap-1" disabled={downloadDisabled}>
            <DownloadIcon />
            <span>Export as CSV</span>
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
            <div>
                <span>Preparing usage export</span>
                <ProgressBar inverted value={progress} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-row items-start space-x-2">
                <ExclamationIcon className="w-5 h-5 mt-0.5" />
                <div>
                    <span>Error exporting your usage data:</span>
                    <pre className="mt-2 whitespace-normal text-sm">{error.message}</pre>
                </div>
            </div>
        );
    }

    if (!data || !data.blob || data.count === 0) {
        return <span>No usage data for the selected period.</span>;
    }

    const readableSize = prettyBytes(data.blob.size);
    const formattedCount = Intl.NumberFormat().format(data.count);

    return (
        <div className="flex flex-row items-start justify-between space-x-2">
            <div>
                <span>Usage export complete.</span>
                <p className="dark:text-gray-500">
                    {readableSize} &middot; {formattedCount} {data.count !== 1 ? "entries" : "entry"} exported
                </p>
            </div>
            <div>
                <LinkButton inverted onClick={saveFile} className="text-left text-base">
                    Download CSV
                </LinkButton>
            </div>
        </div>
    );
};

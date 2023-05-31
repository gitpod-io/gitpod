/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { DownloadUsageCSVResponse, downloadUsageCSV } from "./download-usage-csv";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Dayjs } from "dayjs";
import { useToast } from "../../components/toasts/Toasts";
import { useCurrentOrg } from "../../data/organizations/orgs-query";
import { SpinnerLoader } from "../../components/Loader";
import { ReactComponent as DownloadIcon } from "../../icons/Download.svg";
import { LinkButton } from "../../components/LinkButton";
import { saveAs } from "file-saver";

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
    const [isDownloading, setIsDownloading] = useState(false);
    const [response, setResponse] = useState<DownloadUsageCSVResponse | null>(null);
    const { toast } = useToast();

    const startDownload = useCallback(async () => {
        setIsDownloading(true);

        try {
            const resp = await downloadUsageCSV({
                orgName,
                attributionId: AttributionId.render(attributionId),
                from: startDate.startOf("day").valueOf(),
                to: endDate.endOf("day").valueOf(),
            });
            setResponse(resp);
        } catch (e) {
            console.error(e);
            // TODO: don't open a new toast, just update this existing one
            toast(`There was a problem downloading your usage data: ${e.message}`);
        }

        setIsDownloading(false);
    }, [attributionId, endDate, orgName, startDate, toast]);

    const saveFile = useCallback(() => {
        if (!response || !response.blob) {
            return;
        }

        saveAs(response.blob, response.filename);
    }, [response]);

    useEffect(() => {
        startDownload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isDownloading) {
        return (
            <div className="flex flex-row items-center space-x-2">
                <SpinnerLoader small />
                <span>Preparing usage export</span>
            </div>
        );
    }

    if (!response || response.blob === null) {
        return <span>There are no usage records for that date range</span>;
    }

    return (
        <div className="flex flex-row items-center justify-between space-x-2">
            <span>Usage export complete.</span>
            <LinkButton onClick={saveFile} className="text-left text-base">
                Download CSV file
            </LinkButton>
        </div>
    );
};

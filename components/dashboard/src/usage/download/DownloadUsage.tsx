/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { downloadUsageCSV } from "./download-usage-csv";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Dayjs } from "dayjs";
import { useToast } from "../../components/toasts/Toasts";
import { useCurrentOrg } from "../../data/organizations/orgs-query";

type Props = {
    attributionId: AttributionId;
    startDate: Dayjs;
    endDate: Dayjs;
};
export const DownloadUsage: FC<Props> = ({ attributionId, startDate, endDate }) => {
    const { data: org } = useCurrentOrg();
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleDownload = useCallback(async () => {
        if (!org) {
            return;
        }

        setIsSaving(true);

        try {
            const downloaded = await downloadUsageCSV({
                orgName: org?.slug ?? org?.id,
                attributionId: AttributionId.render(attributionId),
                from: startDate.startOf("day").valueOf(),
                to: endDate.startOf("day").valueOf(),
            });

            if (!downloaded) {
                toast("There are no usage records for that date range");
            }
        } catch (e) {
            console.error(e);
            toast(`There was a problem downloading your usage data: ${e.message}`);
        }

        setIsSaving(false);
    }, [attributionId, endDate, org, startDate, toast]);

    return (
        <Button type="secondary" loading={isSaving} onClick={handleDownload}>
            Download Usage
        </Button>
    );
};

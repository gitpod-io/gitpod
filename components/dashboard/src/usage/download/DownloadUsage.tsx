/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { Button } from "../../components/Button";
import { buildUsageCSV } from "./build-usage-csv";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Dayjs } from "dayjs";
import { useToast } from "../../components/toasts/Toasts";

type Props = {
    attributionId: AttributionId;
    startDate: Dayjs;
    endDate: Dayjs;
};
export const DownloadUsage: FC<Props> = ({ attributionId, startDate, endDate }) => {
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleDownload = useCallback(async () => {
        setIsSaving(true);

        try {
            await buildUsageCSV({
                attributionId: AttributionId.render(attributionId),
                from: startDate.startOf("day").valueOf(),
                to: endDate.startOf("day").valueOf(),
            });
        } catch (e) {
            toast("There was a problem downloading usage data");
        }

        setIsSaving(false);
    }, [attributionId, endDate, startDate, toast]);

    return (
        <Button type="secondary" loading={isSaving} onClick={handleDownload}>
            Download Usage
        </Button>
    );
};

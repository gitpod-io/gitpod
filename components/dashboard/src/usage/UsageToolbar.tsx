/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Dayjs } from "dayjs";
import { useFeatureFlag } from "../data/featureflag-query";
import { FC } from "react";
import classNames from "classnames";
import { DownloadUsage } from "./download/DownloadUsage";
import { UsageDateFilters } from "./UsageDateFilters";

type Props = {
    attributionId: AttributionId;
    startDate: Dayjs;
    endDate: Dayjs;
    onStartDateChange: (val: Dayjs) => void;
    onEndDateChange: (val: Dayjs) => void;
};
export const UsageToolbar: FC<Props> = ({ attributionId, startDate, endDate, onStartDateChange, onEndDateChange }) => {
    const usageDownload = useFeatureFlag("usageDownload");

    return (
        <div
            className={classNames(
                "flex flex-col items-start space-y-3 justify-between px-3",
                "md:flex-row md:items-center md:space-x-4 md:space-y-0",
            )}
        >
            <UsageDateFilters
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={onStartDateChange}
                onEndDateChange={onEndDateChange}
            />
            {usageDownload && <DownloadUsage attributionId={attributionId} startDate={startDate} endDate={endDate} />}
        </div>
    );
};

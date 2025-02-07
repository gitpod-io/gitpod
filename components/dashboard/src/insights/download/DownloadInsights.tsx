/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import prettyBytes from "pretty-bytes";
import { Button } from "@podkit/buttons/Button";
import { useDownloadSessionsCSV } from "./download-sessions";
import { Timestamp } from "@bufbuild/protobuf";
import saveAs from "file-saver";

type Props = {
    from: Timestamp;
    to: Timestamp;
    organizationId: string;
    organizationName: string;
};
export const DownloadInsightsToast = ({ organizationId, from, to, organizationName }: Props) => {
    const [progress, setProgress] = useState(0);

    const queryArgs = useMemo(
        () => ({
            organizationName,
            organizationId,
            from,
            to,
            onProgress: setProgress,
        }),
        [from, organizationId, organizationName, to],
    );
    const { data, error, isLoading, abort, remove } = useDownloadSessionsCSV(queryArgs);

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
                <span>Preparing insights export</span>
                <br />
                <span className="text-sm">Exporting page {progress}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-row items-start space-x-2">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div>
                    <span>Error exporting your insights data:</span>
                    <pre className="mt-2 whitespace-normal text-sm">{error.message}</pre>
                </div>
            </div>
        );
    }

    if (!data || !data.blob || data.count === 0) {
        return <span>No insights data for the selected period.</span>;
    }

    const readableSize = prettyBytes(data.blob.size);
    const formattedCount = Intl.NumberFormat().format(data.count);

    return (
        <div className="flex flex-row items-start justify-between space-x-2">
            <div>
                <span>Insights export complete.</span>
                <p className="dark:text-gray-500">
                    {readableSize} &middot; {formattedCount} {data.count !== 1 ? "entries" : "entry"} exported
                </p>
            </div>
            <div>
                <Button onClick={saveFile} className="text-left text-base">
                    Download CSV
                </Button>
            </div>
        </div>
    );
};

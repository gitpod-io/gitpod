/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { usePrettyRepoURL } from "../../hooks/use-pretty-repo-url";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Text } from "@podkit/typography/Text";
import { LinkButton } from "@podkit/buttons/LinkButton";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { cn } from "@podkit/lib/cn";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";

type Props = {
    configuration: Configuration;
};
export const RepositoryListItem: FC<Props> = ({ configuration }) => {
    const url = usePrettyRepoURL(configuration.cloneUrl);
    const prebuildsEnabled = !!configuration.prebuildSettings?.enabled;
    const created =
        configuration.creationTime
            ?.toDate()
            .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) ?? "";

    return (
        <tr className="border-b transition-colors hover:bg-muted/50">
            <td>
                <div className="flex flex-col gap-1">
                    <Text className="font-semibold">{configuration.name}</Text>
                    <TextMuted className="inline md:hidden text-sm">{url}</TextMuted>
                </div>
            </td>

            <td className="hidden md:table-cell">
                <TextMuted className="text-sm">{url}</TextMuted>
            </td>

            <td className="hidden md:table-cell">{created}</td>

            <td className="hidden md:table-cell">
                <div className="flex flex-row gap-1 items-center">
                    {prebuildsEnabled ? (
                        <CheckCircle2Icon size={16} className="text-green-500" />
                    ) : (
                        <AlertTriangleIcon size={16} className="text-red-500" />
                    )}

                    <TextMuted className={cn(!prebuildsEnabled && "text-red-500")}>
                        {prebuildsEnabled ? "Enabled" : "Disabled"}
                    </TextMuted>
                </div>
            </td>

            <td>
                <LinkButton href={`/repositories/${configuration.id}`} variant="secondary">
                    View
                </LinkButton>
            </td>
        </tr>
    );
};

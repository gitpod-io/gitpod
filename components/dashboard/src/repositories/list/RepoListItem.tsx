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
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { TableCell, TableRow } from "@podkit/tables/Table";
import PillLabel from "../../components/PillLabel";

type Props = {
    configuration: Configuration;
    isSuggested: boolean;
};
export const RepositoryListItem: FC<Props> = ({ configuration, isSuggested }) => {
    const url = usePrettyRepoURL(configuration.cloneUrl);
    const prebuildsEnabled = !!configuration.prebuildSettings?.enabled;
    const created =
        configuration.creationTime
            ?.toDate()
            .toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) ?? "";

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col gap-1 break-words w-auto md:w-64">
                    <Text className="font-semibold flex items-center justify-between gap-1">
                        {configuration.name}
                        {isSuggested && (
                            <PillLabel
                                className="capitalize bg-kumquat-light shrink-0 text-sm hidden xl:block"
                                type="warn"
                            >
                                Suggested
                            </PillLabel>
                        )}
                    </Text>
                    {/* We show the url on a 2nd line for smaller screens since we hide the column */}
                    <TextMuted className="inline md:hidden text-sm break-all">{url}</TextMuted>
                </div>
            </TableCell>

            <TableCell hideOnSmallScreen>
                <TextMuted className="text-sm break-all">{url}</TextMuted>
            </TableCell>

            <TableCell hideOnSmallScreen>{created}</TableCell>

            <TableCell hideOnSmallScreen>
                <div className="flex flex-row gap-1 items-center">
                    {prebuildsEnabled ? (
                        <CheckCircle2Icon size={20} className="text-green-500" />
                    ) : (
                        <AlertTriangleIcon size={20} className="text-kumquat-base" />
                    )}

                    <TextMuted>{prebuildsEnabled ? "Enabled" : "Disabled"}</TextMuted>
                </div>
            </TableCell>

            <TableCell>
                <LinkButton href={`/repositories/${configuration.id}`} variant="secondary">
                    View
                </LinkButton>
            </TableCell>
        </TableRow>
    );
};

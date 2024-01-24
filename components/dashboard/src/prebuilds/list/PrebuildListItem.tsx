/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Text } from "@podkit/typography/Text";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { TableCell, TableRow } from "@podkit/tables/Table";
import type { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { prebuildDisplayProps, prebuildStatusIconName } from "../../projects/Prebuilds";
import dayjs from "dayjs";
import { cn } from "@podkit/lib/cn";
import { shortCommitMessage } from "../../projects/render-utils";

type Props = {
    prebuild: Prebuild;
};
export const RepositoryListItem: FC<Props> = ({ prebuild }) => {
    const created = dayjs(prebuild.status?.startTime?.toDate()).fromNow();
    const { data: configuration } = useConfiguration(prebuild.configurationId);
    const { className: iconColorClass, label } = prebuildDisplayProps(prebuild);
    const PrebuildStatusIcon = prebuildStatusIconName(prebuild);

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col gap-1">
                    <Text className="text-sm text-pk-content-primary text-semibold">{configuration?.name}</Text>
                    <TextMuted className="text-xs break-all">branch (soon™)</TextMuted>
                </div>
            </TableCell>

            <TableCell hideOnSmallScreen>
                {prebuild.commit?.author && (
                    <div className="flex flex-col gap-1">
                        <Text className="text-sm text-pk-content-secondary">
                            {shortCommitMessage(prebuild.commit.message)}
                        </Text>
                        <div className="flex gap-1">
                            <img src={prebuild.commit.author.avatarUrl} className="w-5 h-5 rounded-full" alt="" />
                            <Text className="text-xs break-all text-pk-content-secondary">
                                {prebuild.commit.author.name}
                            </Text>
                        </div>
                    </div>
                )}
            </TableCell>

            <TableCell hideOnSmallScreen>
                <span className="text-pk-content-secondary text-sm">{created}</span>
            </TableCell>

            <TableCell>
                <div className="flex flex-row gap-1.5 items-center capitalize">
                    <PrebuildStatusIcon className={cn("w-5 h-5", iconColorClass)} />
                    <span className="text-sm text-pk-content-secondary">{label}</span>
                </div>
            </TableCell>

            <TableCell>
                <LinkButton href={`/repositories/${prebuild.id}`} variant="secondary">
                    View
                </LinkButton>
            </TableCell>
        </TableRow>
    );
};

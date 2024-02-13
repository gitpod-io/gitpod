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
import dayjs from "dayjs";
import { cn } from "@podkit/lib/cn";
import { shortCommitMessage } from "../../projects/render-utils";
import { Link } from "react-router-dom";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { LoadingState } from "@podkit/loading/LoadingState";
import { prebuildDisplayProps, prebuildStatusIconComponent } from "../../projects/prebuild-utils";

type Props = {
    prebuild: Prebuild;
};
export const PrebuildListItem: FC<Props> = ({ prebuild }) => {
    const created = dayjs(prebuild.status?.startTime?.toDate()).fromNow();
    const {
        data: configuration,
        isError: isConfigurationError,
        isLoading: isConfigurationLoading,
    } = useConfiguration(prebuild.configurationId);
    const { className: iconColorClass, label } = prebuildDisplayProps(prebuild);
    const PrebuildStatusIcon = prebuildStatusIconComponent(prebuild);

    return (
        <TableRow>
            <TableCell>
                <div className="flex flex-col gap-1">
                    <Text className="text-sm text-pk-content-primary text-semibold break-all">
                        <ConfigurationField
                            configuration={configuration}
                            isError={isConfigurationError}
                            isLoading={isConfigurationLoading}
                        />
                    </Text>
                    <TextMuted className="text-xs break-all">{prebuild.ref}</TextMuted>
                </div>
            </TableCell>

            <TableCell hideOnSmallScreen>
                {prebuild.commit?.author && (
                    <div className="flex flex-col gap-1">
                        <Text className="text-sm text-pk-content-secondary">
                            {shortCommitMessage(prebuild.commit.message)}
                        </Text>
                        <div className="flex gap-1 items-center">
                            <img src={prebuild.commit.author.avatarUrl} className="w-5 h-5 rounded-full" alt="" />
                            <Text className="text-xs break-all text-pk-content-secondary">
                                {prebuild.commit.author.name}
                            </Text>
                        </div>
                    </div>
                )}
            </TableCell>

            <TableCell hideOnSmallScreen>
                <Text className="text-sm break-all text-pk-content-secondary">{created}</Text>
            </TableCell>

            <TableCell>
                <div className="flex flex-row gap-1.5 items-center capitalize">
                    <PrebuildStatusIcon className={cn("w-5 h-5", iconColorClass)} />
                    <span className="text-sm text-pk-content-secondary">{label}</span>
                </div>
            </TableCell>

            <TableCell>
                <LinkButton href={`/prebuilds/${prebuild.id}`} disabled variant="secondary">
                    View
                </LinkButton>
            </TableCell>
        </TableRow>
    );
};

type ConfigurationProps = {
    configuration?: Configuration;
    isLoading: boolean;
    isError: boolean;
};
const ConfigurationField = ({ configuration, isLoading, isError }: ConfigurationProps) => {
    if (isLoading) {
        return <LoadingState size={16} />;
    }

    if (isError || !configuration?.name || !configuration.id) {
        return <Text>Unknown repository</Text>;
    }

    return <Link to={`/repositories/${configuration.id}`}>{configuration.name}</Link>;
};

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { usePrettyRepoURL } from "../../hooks/use-pretty-repo-url";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Text } from "@podkit/typography/Text";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

type Props = {
    configuration: Configuration;
};
export const RepositoryListItem: FC<Props> = ({ configuration }) => {
    const url = usePrettyRepoURL(configuration.cloneUrl);

    return (
        <li key={configuration.id} className="flex flex-row w-full space-between items-center">
            <div className="flex flex-col flex-grow gap-1">
                <Text className="font-semibold">{configuration.name}</Text>
                <TextMuted className="text-sm">{url}</TextMuted>
            </div>

            <div>
                <Link to={`/configurations/${configuration.id}`}>
                    <Button type="secondary">View</Button>
                </Link>
            </div>
        </li>
    );
};

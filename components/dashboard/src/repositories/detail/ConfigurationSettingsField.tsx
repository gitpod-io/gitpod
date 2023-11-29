/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";

interface Props {
    children: React.ReactNode;
    className?: string;
}

export const ConfigurationSettingsField = ({ children, className }: Props) => {
    return (
        <div className={cn("border border-gray-300 dark:border-gray-700 rounded-xl p-6", className)}>{children}</div>
    );
};

/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames, { Argument } from "classnames";
import { twMerge } from "tailwind-merge";

// Helper type to add a className prop to a component
export type PropsWithClassName<Props = {}> = {
    className?: string;
} & Props;

// Helper fn to merge tailwind classes with a className prop
export function cn(...inputs: Argument[]) {
    return twMerge(classNames(inputs));
}

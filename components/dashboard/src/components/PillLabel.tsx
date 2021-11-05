/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * Renders a pill.
 *
 * **type**\
 * info: Renders a blue pile label (default).\
 * warn: Renders an orange pile label.
 *
 * **className**\
 * Add additional css classes to style this component.
 */
export default function PillLabel(props: { children?: React.ReactNode, type?: "info" | "warn", className?: string }) {
    const infoStyle = "bg-blue-50 text-blue-500 dark:bg-blue-500 dark:text-blue-100";
    const warnStyle = "bg-orange-100 text-orange-700 dark:bg-orange-600 dark:text-orange-100";
    const style = `ml-2 px-3 py-1 text-sm uppercase rounded-xl ${props.type === "warn" ? warnStyle : infoStyle} ${props.className}`;
    return <span className={style}>{props.children}</span>;
}

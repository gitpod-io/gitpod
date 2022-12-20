/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export type PillType = "info" | "warn" | "success" | "neutral";

const PillClsMap: Record<PillType, string> = {
    info: "bg-blue-50 text-blue-500 dark:bg-blue-500 dark:text-blue-100",
    warn: "bg-orange-100 text-orange-700 dark:bg-orange-600 dark:text-orange-100",
    success: "bg-green-100 text-green-700 dark:bg-green-600 dark:text-green-100",
    neutral: "bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-100",
};

/**
 * Renders a pill.
 *
 * **type**\
 * info: Renders a blue pile label (default).\
 * warn: Renders an orange pile label.
 * success: Renders an green pile label.
 * subtle: Renders a grey pile label.
 *
 * **className**\
 * Add additional css classes to style this component.
 */
export default function PillLabel(props: { children?: React.ReactNode; type?: PillType; className?: string }) {
    const type = props.type || "info";
    const style = `px-2 py-1 text-sm uppercase rounded-xl ${PillClsMap[type]} ${props.className}`;
    return <span className={style}>{props.children}</span>;
}

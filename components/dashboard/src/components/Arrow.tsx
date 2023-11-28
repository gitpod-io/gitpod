/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

function Arrow(props: { direction: string; customBorderClasses?: string }) {
    const { direction, customBorderClasses } = props;

    // Using any because of known TS bug with bracket notation:
    // https://github.com/microsoft/TypeScript/issues/10530
    const directionMap: any = {
        up: "-135deg",
        down: "45deg",
        left: "135deg",
        right: "315deg",
    };
    return (
        <span
            className={`mx-2 ${
                customBorderClasses ||
                "border-gray-400 dark:border-gray-500 group-hover:border-gray-600 dark:group-hover:border-gray-400"
            }`}
            style={{
                marginTop: 2,
                marginBottom: 2,
                padding: 3,
                borderWidth: "0 2px 2px 0",
                display: "inline-block",
                transform: `rotate(${directionMap[direction]})`,
            }}
        />
    );
}

export default Arrow;

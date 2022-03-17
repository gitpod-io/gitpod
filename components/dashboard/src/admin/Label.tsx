/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

function Label(p: { text: string; color: string }) {
    return (
        <span
            className={`ml-3 text-sm text-${p.color}-600 truncate bg-${p.color}-100 px-1.5 py-0.5 rounded-md my-auto w-max`}
        >
            {p.text}
        </span>
    );
}

export default Label;

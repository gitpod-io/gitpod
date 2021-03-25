/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Separator from "./Separator";

export interface HeaderProps {
    title: string;
    subtitle: string;
}

export default function Header(p: HeaderProps) {
    return <div className="lg:px-28 px-10 border-gray-200">
        <div className="flex pb-8 pt-6">
            <div className="">
                <h1 className="tracking-tight">{p.title}</h1>
                <h2 className="tracking-wide">{p.subtitle}</h2>
            </div>
        </div>
        <Separator />
    </div>;
}
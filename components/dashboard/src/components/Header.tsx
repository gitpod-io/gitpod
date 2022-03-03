/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect } from 'react';
import Separator from './Separator';

export interface HeaderProps {
    title: string | React.ReactElement;
    subtitle: string | React.ReactElement;
}

export default function Header(p: HeaderProps) {
    useEffect(() => {
        if (typeof p.title !== 'string') {
            return;
        }
        document.title = `${p.title} — Gitpod`;
    }, []);
    return (
        <div className="app-container border-gray-200 dark:border-gray-800">
            <div className="flex pb-8 pt-6">
                <div className="">
                    {typeof p.title === 'string' ? <h1 className="tracking-tight">{p.title}</h1> : p.title}
                    {typeof p.subtitle === 'string' ? <h2 className="tracking-wide">{p.subtitle}</h2> : p.subtitle}
                </div>
            </div>
            <Separator />
        </div>
    );
}

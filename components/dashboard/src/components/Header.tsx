/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useLocation } from "react-router";
import { useDocumentTitle } from "../hooks/use-document-title";
import { Separator } from "./Separator";
import TabMenuItem from "./TabMenuItem";
import { Heading1, Subheading } from "./typography/headings";

export interface HeaderProps {
    title: string;
    complexTitle?: React.ReactElement;
    subtitle?: string | React.ReactElement;
    tabs?: TabEntry[];
}

export interface TabEntry {
    title: string;
    link: string;
    alternatives?: string[];
}

export default function Header(p: HeaderProps) {
    const location = useLocation();
    useDocumentTitle(`${p.title}`);
    return (
        <div className="app-container border-gray-200 dark:border-gray-800">
            <div className="flex pb-8 pt-6">
                <div className="w-full">
                    {p.complexTitle ? p.complexTitle : <Heading1 tracking="tight">{p.title}</Heading1>}
                    {p.subtitle && typeof p.subtitle === "string" ? (
                        <Subheading tracking="wide">{p.subtitle}</Subheading>
                    ) : (
                        p.subtitle
                    )}
                </div>
            </div>
            <nav className="flex">
                {p.tabs?.map((entry) => (
                    <TabMenuItem
                        key={entry.title}
                        name={entry.title}
                        selected={[entry.link, ...(entry.alternatives || [])].some(
                            (l) => location.pathname.toLowerCase() === l.toLowerCase(),
                        )}
                        link={entry.link}
                    />
                ))}
            </nav>
            <Separator />
        </div>
    );
}

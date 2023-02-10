/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import Header from "../components/Header";
import { getAdminTabs } from "./admin.routes";

export interface AdminPageHeaderProps {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

export function AdminPageHeader({ title, subtitle, children }: AdminPageHeaderProps) {
    return (
        <>
            <Header title={title} subtitle={subtitle} tabs={getAdminTabs()} />
            {children}
        </>
    );
}

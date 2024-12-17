/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PageHeading } from "@podkit/layout/PageHeading";
import { PrebuildsList } from "./PrebuildList";
import { useDocumentTitle } from "../../hooks/use-document-title";

const PrebuildListPage = () => {
    useDocumentTitle("Prebuilds");

    return (
        <div className="app-container pb-8">
            <PageHeading title="Prebuilds" subtitle="Review prebuilds of your added repositories." />
            <PrebuildsList />
        </div>
    );
};

export default PrebuildListPage;

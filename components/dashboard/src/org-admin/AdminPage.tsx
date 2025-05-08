/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import { useUserLoader } from "../hooks/use-user-loader";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useIsOwner } from "../data/organizations/members-query";
import { useDocumentTitle } from "../hooks/use-document-title";
import { PageHeading } from "@podkit/layout/PageHeading";

const AdminPage: React.FC = () => {
    useDocumentTitle("Administration");
    const history = useHistory();
    const { loading: userLoading } = useUserLoader();
    const { data: currentOrg, isLoading: orgLoading } = useCurrentOrg();
    const isOwner = useIsOwner();

    useEffect(() => {
        if (userLoading || orgLoading) {
            return;
        }
        if (!isOwner) {
            history.replace("/workspaces");
        }
    }, [isOwner, userLoading, orgLoading, history, currentOrg?.id]);

    if (userLoading || orgLoading || !isOwner) {
        return null;
    }

    return (
        <div className="app-container pb-8">
            <PageHeading title="Administration" subtitle="Administrative tools and settings will be available here." />
            {/* Future content goes here */}
        </div>
    );
};

export default AdminPage;

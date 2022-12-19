/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import Alert from "../components/Alert";

export const LocalPreviewAlert = () => {
    return (
        <div className="app-container mt-2">
            <Alert type="warning" className="app-container rounded-md">
                You are using a <b>local preview</b> installation, intended for exploring the product on a single
                machine without requiring a Kubernetes cluster.{" "}
                <a
                    className="gp-link hover:text-gray-600"
                    href="https://www.gitpod.io/community-license?utm_source=local-preview"
                >
                    Request a community license
                </a>{" "}
                or{" "}
                <a
                    className="gp-link hover:text-gray-600"
                    href="https://www.gitpod.io/contact/sales?utm_source=local-preview"
                >
                    contact sales
                </a>{" "}
                to get a professional license for running Gitpod in production.
            </Alert>
        </div>
    );
};

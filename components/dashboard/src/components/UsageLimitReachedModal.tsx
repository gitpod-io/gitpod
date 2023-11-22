/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Button } from "@podkit/buttons/Button";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import Alert from "./Alert";
import Modal from "./Modal";
import { Heading2 } from "./typography/headings";

export function UsageLimitReachedModal(p: { onClose?: () => void }) {
    const currentOrg = useCurrentOrg();

    const orgName = currentOrg.data?.name;
    const billingLink = "/billing";
    return (
        <Modal visible={true} closeable={!!p.onClose} onClose={p.onClose || (() => {})}>
            <Heading2 className="flex">
                <span className="flex-grow">Usage Limit Reached</span>
            </Heading2>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 mt-4 -mx-6 px-6 py-6">
                <Alert type="error" className="app-container rounded-md">
                    You have reached the <strong>usage limit</strong> of your billing account.
                </Alert>
                <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
                    {"Contact an organization owner "}
                    {orgName && (
                        <span>
                            of <strong>{orgName} </strong>
                        </span>
                    )}
                    to increase the usage limit, or change your <a href={billingLink}>billing settings</a>.
                </p>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <a href={billingLink}>
                    <Button variant="secondary">Go to Billing</Button>
                </a>
            </div>
        </Modal>
    );
}

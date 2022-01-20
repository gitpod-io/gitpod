/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { InstallationAdminSettings } from "@gitpod/gitpod-protocol";
import { AdminContext } from "../admin-context";
import CheckBox from "../components/CheckBox";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getGitpodService } from "../service/service";
import { adminMenu } from "./admin-menu";

export default function Settings() {
    const { adminSettings, setAdminSettings } = useContext(AdminContext);

    const actuallySetTelemetryPrefs = async (value: InstallationAdminSettings) => {
        await getGitpodService().server.adminUpdateSettings(value);
        setAdminSettings(value);
    }

    return (
        <div>
            <PageWithSubMenu subMenu={adminMenu} title="Settings" subtitle="Configure settings for your Gitpod cluster.">
                <h3>Usage Statistics</h3>
                <CheckBox
                    title="Enable Service Ping"
                    desc={<span>This is used to provide insights on how you use your cluster so we can provide a better overall experience. <a className="gp-link" href="https://www.gitpod.io/privacy">Read our Privacy Policy</a></span>}
                    checked={adminSettings?.sendTelemetry ?? false}
                    onChange={(evt) => actuallySetTelemetryPrefs({
                        sendTelemetry: evt.target.checked,
                    })} />
            </PageWithSubMenu>
        </div >
    )
}

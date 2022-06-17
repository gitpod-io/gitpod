/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { TelemetryData, InstallationAdminSettings } from "@gitpod/gitpod-protocol";
import { AdminContext } from "../admin-context";
import CheckBox from "../components/CheckBox";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getGitpodService } from "../service/service";
import { adminMenu } from "./admin-menu";
import { useEffect, useState } from "react";
import InfoBox from "../components/InfoBox";
import { isGitpodIo } from "../utils";

export default function Settings() {
    const { adminSettings, setAdminSettings } = useContext(AdminContext);
    const [telemetryData, setTelemetryData] = useState<TelemetryData>();

    useEffect(() => {
        if (isGitpodIo()) {
            return; // temporarily disable to avoid hight CPU on the DB
        }
        (async () => {
            const data = await getGitpodService().server.adminGetTelemetryData();
            setTelemetryData(data);

            const setting = await getGitpodService().server.adminGetSettings();
            setAdminSettings(setting);
        })();
    }, []);

    const actuallySetTelemetryPrefs = async (value: InstallationAdminSettings) => {
        await getGitpodService().server.adminUpdateSettings(value);
        setAdminSettings(value);
    };

    return (
        <div>
            <PageWithSubMenu
                subMenu={adminMenu}
                title="Settings"
                subtitle="Configure settings for your Gitpod cluster."
            >
                <h3>Usage Statistics</h3>
                <CheckBox
                    title="Enable Service Ping"
                    desc={
                        <span>
                            The following usage data is sent to provide insights on how you use your Gitpod instance, so
                            we can provide a better overall experience.{" "}
                            <a className="gp-link" href="https://www.gitpod.io/privacy">
                                Read our Privacy Policy
                            </a>
                        </span>
                    }
                    checked={adminSettings?.sendTelemetry ?? false}
                    onChange={(evt) =>
                        actuallySetTelemetryPrefs({
                            ...adminSettings,
                            sendTelemetry: evt.target.checked,
                        } as InstallationAdminSettings)
                    }
                />
                <CheckBox
                    title="Include customer ID in telemetry"
                    desc={
                        <span>
                            An optional customer ID can be included with telemetry to provide better customer support.{" "}
                            <a className="gp-link" href="https://www.gitpod.io/privacy">
                                Read our Privacy Policy
                            </a>
                        </span>
                    }
                    checked={adminSettings?.sendCustomerID ?? false}
                    onChange={(evt) =>
                        actuallySetTelemetryPrefs({
                            ...adminSettings,
                            sendCustomerID: evt.target.checked,
                        } as InstallationAdminSettings)
                    }
                />
                <InfoBox>
                    <pre>{JSON.stringify(telemetryData, null, 2)}</pre>
                </InfoBox>
            </PageWithSubMenu>
        </div>
    );
}

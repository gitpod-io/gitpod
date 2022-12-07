/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { TelemetryData, InstallationAdminSettings } from "@gitpod/gitpod-protocol";
import { AdminContext } from "../admin-context";
import CheckBox from "../components/CheckBox";
import { getGitpodService } from "../service/service";
import { useEffect, useState } from "react";
import InfoBox from "../components/InfoBox";
import { isGitpodIo } from "../utils";
import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";

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
            <PageWithAdminSubMenu title="Settings" subtitle="Configure settings for your Gitpod cluster.">
                <h3>Usage Statistics</h3>
                <p className="text-base text-gray-500 pb-4 max-w-2xl">
                    We collect usage telemetry to gain insights on how you use your Gitpod instance, so we can provide a
                    better overall experience.
                </p>
                <p>
                    <a className="gp-link" href="https://www.gitpod.io/privacy">
                        Read our Privacy Policy
                    </a>
                </p>
                <CheckBox
                    title="Enable usage telemetry"
                    desc={
                        <span>
                            Enable usage telemetry on your Gitpod instance. A preview of your telemetry is available
                            below.
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
                            Include an optional customer ID in usage telemetry to provide individualized support.
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
                <h3 className="mt-4">Telemetry preview</h3>
                <InfoBox>
                    <pre>{JSON.stringify(telemetryData, null, 2)}</pre>
                </InfoBox>
            </PageWithAdminSubMenu>
        </div>
    );
}

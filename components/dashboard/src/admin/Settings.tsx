/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useContext } from "react";
import { TelemetryData, InstallationAdminSettings } from "@gitpod/gitpod-protocol";
import { AdminContext } from "../admin-context";
import { CheckboxInput, CheckboxInputContainer } from "../components/forms/CheckboxInputField";
import { getGitpodService } from "../service/service";
import { useEffect, useState } from "react";
import InfoBox from "../components/InfoBox";
import { isGitpodIo } from "../utils";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getAdminTabs, getAdminSettingsMenu } from "./admin.routes";
import { Heading2, Subheading } from "../components/typography/headings";

export function SettingsLayout(props: { children: React.ReactNode }) {
    return (
        <PageWithSubMenu
            subMenu={getAdminSettingsMenu()}
            title="Admin"
            subtitle="Configure and manage instance settings."
            tabs={getAdminTabs()}
        >
            {props.children}
        </PageWithSubMenu>
    );
}

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
            <SettingsLayout>
                <Heading2>Usage Statistics</Heading2>
                <Subheading className="pb-4 max-w-2xl">
                    We collect usage telemetry to gain insights on how you use your Gitpod instance, so we can provide a
                    better overall experience.
                </Subheading>
                <p>
                    <a className="gp-link" href="https://www.gitpod.io/privacy">
                        Read our Privacy Policy
                    </a>
                </p>
                <CheckboxInputContainer>
                    <CheckboxInput
                        value="Enable usage telemetry"
                        label="Enable usage telemetry"
                        hint="Enable usage telemetry on your Gitpod instance. A preview of your telemetry is available
                        below."
                        checked={adminSettings?.sendTelemetry ?? false}
                        onChange={(checked) =>
                            actuallySetTelemetryPrefs({
                                ...adminSettings,
                                sendTelemetry: checked,
                            } as InstallationAdminSettings)
                        }
                    />

                    <CheckboxInput
                        value="Include customer ID"
                        label="Include customer ID in telemetry"
                        hint="Include an optional customer ID in usage telemetry to provide individualized support."
                        checked={adminSettings?.sendCustomerID ?? false}
                        onChange={(checked) =>
                            actuallySetTelemetryPrefs({
                                ...adminSettings,
                                sendCustomerID: checked,
                            } as InstallationAdminSettings)
                        }
                    />
                </CheckboxInputContainer>
                <Heading2 className="mt-4">Telemetry preview</Heading2>
                <InfoBox>
                    <pre>{JSON.stringify(telemetryData, null, 2)}</pre>
                </InfoBox>
            </SettingsLayout>
        </div>
    );
}

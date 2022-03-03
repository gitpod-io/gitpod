/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from 'react';
import { TelemetryData, InstallationAdminSettings } from '@gitpod/gitpod-protocol';
import { AdminContext } from '../admin-context';
import CheckBox from '../components/CheckBox';
import { PageWithSubMenu } from '../components/PageWithSubMenu';
import { getGitpodService } from '../service/service';
import { adminMenu } from './admin-menu';
import { useEffect, useState } from 'react';
import InfoBox from '../components/InfoBox';
import { Redirect } from 'react-router-dom';
import { UserContext } from '../user-context';

export default function Settings() {
    const { adminSettings, setAdminSettings } = useContext(AdminContext);
    const [telemetryData, setTelemetryData] = useState<TelemetryData>();
    const { user } = useContext(UserContext);

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

    if (!user || !user?.rolesOrPermissions?.includes('admin')) {
        return <Redirect to="/" />;
    }

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
                            we can provide a better overall experience.{' '}
                            <a className="gp-link" href="https://www.gitpod.io/privacy">
                                Read our Privacy Policy
                            </a>
                        </span>
                    }
                    checked={adminSettings?.sendTelemetry ?? false}
                    onChange={(evt) =>
                        actuallySetTelemetryPrefs({
                            sendTelemetry: evt.target.checked,
                        })
                    }
                />
                <InfoBox>
                    <pre>{JSON.stringify(telemetryData, null, 2)}</pre>
                </InfoBox>
            </PageWithSubMenu>
        </div>
    );
}

function isGitpodIo() {
    return window.location.hostname === 'gitpod.io' || window.location.hostname === 'gitpod-staging.com';
}

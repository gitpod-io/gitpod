/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LicenseContext } from "../license-context";
import { ReactElement, useContext, useEffect } from "react";
import { getGitpodService } from "../service/service";

import { ReactComponent as Alert } from "../images/exclamation.svg";
import { ReactComponent as Success } from "../images/check-circle.svg";
import { LicenseInfo } from "@gitpod/gitpod-protocol";
import { ReactComponent as XSvg } from "../images/x.svg";
import { ReactComponent as CheckSvg } from "../images/check.svg";
import { ReactComponent as LinkSvg } from "../images/external-link.svg";
import SolidCard from "../components/SolidCard";
import Card from "../components/Card";
import { isGitpodIo } from "../utils";
import { SettingsLayout } from "./Settings";

export default function License() {
    const { license, setLicense } = useContext(LicenseContext);

    useEffect(() => {
        if (isGitpodIo()) {
            return; // temporarily disable to avoid hight CPU on the DB
        }
        (async () => {
            const data = await getGitpodService().server.adminGetLicense();
            setLicense(data);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const userLimit = "Unlimited";

    const [licenseLevel, paid, statusMessage] = license ? getSubscriptionLevel(license) : defaultMessage();

    return (
        <div>
            <SettingsLayout>
                <div className="flex flex-row space-x-4">
                    <Card className="w-72 h-64">
                        <span>
                            {licenseLevel}
                            {paid}
                        </span>
                    </Card>
                    <SolidCard className="w-72 h-64">
                        <span>
                            <div className="my-2">{statusMessage}</div>
                            <p className="dark:text-gray-500 font-semibold">Registered Users</p>
                            <span className="dark:text-gray-300 text-lg">{license?.userCount || 0}</span>
                            <span className="dark:text-gray-500 text-gray-400 pt-1 text-lg"> / {userLimit} </span>
                        </span>
                    </SolidCard>
                </div>
            </SettingsLayout>
        </div>
    );
}

function getSubscriptionLevel(license: LicenseInfo): ReactElement[] {
    return professionalPlan(license.userCount || 0);
}

function licenseLevel(level: string): ReactElement {
    return <div className="text-white dark:text-black font-semibold mt-4"> {level}</div>;
}

function additionalLicenseInfo(data: string): ReactElement {
    return <div className="dark:text-gray-500 text-gray-400 font-semibold text-sm">{data}</div>;
}

function defaultMessage(): ReactElement[] {
    const alertMessage = () => {
        return (
            <span className="text-gray-600 dark:text-gray-50 flex font-semibold items-center">
                <div>Inactive or unknown license</div>
                <div className="flex justify-right my-4 mr-2 ml-4">
                    <Alert fill="grey" className="h-8 w-8" />
                </div>
            </span>
        );
    };

    return [licenseLevel("Inactive"), additionalLicenseInfo("Free"), alertMessage()];
}

function professionalPlan(userCount: number): ReactElement[] {
    const alertMessage = () => {
        return (
            <span className="text-green-600 dark:text-green-400 flex font-semibold items-center">
                <div>You have an active professional license.</div>
                <div className="flex justify-right my-4 mr-2 ml-4">
                    <Success className="h-8 w-8" />
                </div>
            </span>
        );
    };

    return [licenseLevel("Professional"), additionalLicenseInfo("Paid"), alertMessage()];
}

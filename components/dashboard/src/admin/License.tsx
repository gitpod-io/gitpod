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
import { PageWithAdminSubMenu } from "./PageWithAdminSubMenu";

export default function License() {
    const { license, setLicense } = useContext(LicenseContext);

    useEffect(() => {
        if (isGitpodIo()) {
            return; // temporarily disable to avoid hight CPU on the DB
        }
        (async () => {
            const data = await getGitpodService(true).server.adminGetLicense();
            setLicense(data);
        })();
    }, []);

    const featureList = license?.enabledFeatures;
    const features = license?.features;

    // if user seats is 0, it means that there is no user limit in the license
    const userLimit = license?.seats === 0 ? "Unlimited" : license?.seats;

    const [licenseLevel, paid, statusMessage] = license ? getSubscriptionLevel(license) : defaultMessage();

    return (
        <div>
            <PageWithAdminSubMenu title="License" subtitle="License associated with your Gitpod installation">
                <div className="flex flex-row space-x-4">
                    <Card className="w-72 h-64">
                        <span>
                            {licenseLevel}
                            {paid}
                            <div className="mt-4 font-semibold text-sm">Available features:</div>
                            <div className="flex flex-col items-start text-sm">
                                {features &&
                                    features.map((feat: string) => (
                                        <span className="inline-flex space-x-1">
                                            {featureList?.includes(feat) ? (
                                                <CheckSvg fill="currentColor" className="self-center mt-1" />
                                            ) : (
                                                <XSvg fill="currentColor" className="self-center h-2 mt-1" />
                                            )}
                                            <span>{capitalizeInitials(feat)}</span>
                                        </span>
                                    ))}
                            </div>
                        </span>
                    </Card>
                    <SolidCard className="w-72 h-64">
                        <span>
                            <div className="my-2">{statusMessage}</div>
                            <p className="dark:text-gray-500 font-semibold">Registered Users</p>
                            <span className="dark:text-gray-300 text-lg">{license?.userCount || 0}</span>
                            <span className="dark:text-gray-500 text-gray-400 pt-1 text-lg"> / {userLimit} </span>
                            <p className="dark:text-gray-500 pt-2 font-semibold">License Type</p>
                            <h4 className="dark:text-gray-300 text-lg">{capitalizeInitials(license?.type || "")}</h4>
                            <a
                                className="gp-link flex flex-row mr-2 justify-end font-semibold space-x-2 mt-6"
                                href="https://www.gitpod.io/self-hosted"
                                target="_blank"
                            >
                                <span className="text-sm">Compare Plans</span>
                                <div className="self-end">
                                    <LinkSvg />
                                </div>
                            </a>
                        </span>
                    </SolidCard>
                </div>
            </PageWithAdminSubMenu>
        </div>
    );
}

function capitalizeInitials(str: string): string {
    return str
        .split("-")
        .map((item) => {
            return item.charAt(0).toUpperCase() + item.slice(1);
        })
        .join(" ");
}

function getSubscriptionLevel(license: LicenseInfo): ReactElement[] {
    switch (license.plan) {
        case "prod":
        case "trial":
            return professionalPlan(license.userCount || 0, license.seats, license.plan == "trial", license.validUntil);
        case "community":
            return communityPlan(license.userCount || 0, license.seats, license.fallbackAllowed);
        default: {
            return defaultMessage();
        }
    }
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

function professionalPlan(userCount: number, seats: number, trial: boolean, validUntil: string): ReactElement[] {
    const alertMessage = (aboveLimit: boolean) => {
        return aboveLimit ? (
            <span className="text-red-700 dark:text-red-400 flex font-semibold items-center">
                <div>You have exceeded the usage limit.</div>
                <div className="flex justify-right my-4 mr-2 ml-4">
                    <Alert className="h-6 w-6" />
                </div>
            </span>
        ) : (
            <span className="text-green-600 dark:text-green-400 flex font-semibold items-center">
                <div>You have an active professional license.</div>
                <div className="flex justify-right my-4 mr-2 ml-4">
                    <Success className="h-8 w-8" />
                </div>
            </span>
        );
    };

    // seats === 0 means unlimited number of users
    const aboveLimit: boolean = seats === 0 ? false : userCount > seats;

    const licenseTitle = () => {
        const expDate = new Date(validUntil);
        if (typeof expDate.getTime !== "function") {
            return trial ? additionalLicenseInfo("Trial") : additionalLicenseInfo("Paid");
        } else {
            return additionalLicenseInfo(
                "Expires on " +
                    expDate.toLocaleDateString("en-DB", { year: "numeric", month: "short", day: "numeric" }),
            );
        }
    };

    return [licenseLevel("Professional"), licenseTitle(), alertMessage(aboveLimit)];
}

function communityPlan(userCount: number, seats: number, fallbackAllowed: boolean): ReactElement[] {
    const alertMessage = (aboveLimit: boolean) => {
        if (aboveLimit) {
            return fallbackAllowed ? (
                <div className="text-gray-600 dark:text-gray-50 flex font-semibold items-center">
                    <div>No active license. You are using community edition.</div>
                    <div className="my-4 mr-2 ml-4">
                        <Success className="h-8 w-8" />
                    </div>
                </div>
            ) : (
                <span className="text-red-700 dark:text-red-400 flex font-semibold items-center">
                    <div>No active license. You have exceeded the usage limit.</div>
                    <div className="flex justify-right my-4 mr-2 ml-4">
                        <Alert className="h-8 w-8" />
                    </div>
                </span>
            );
        } else {
            return (
                <span className="text-green-600 dark:text-green-400 flex font-semibold items-center">
                    <div>You are using the free community edition.</div>
                    <div className="flex justify-right my-4 mr-2 ml-4">
                        <Success fill="green" className="h-8 w-8" />
                    </div>
                </span>
            );
        }
    };

    // seats === 0 means unlimited number of users
    const aboveLimit: boolean = seats === 0 ? false : userCount > seats;

    return [licenseLevel("Community"), additionalLicenseInfo("Free"), alertMessage(aboveLimit)];
}

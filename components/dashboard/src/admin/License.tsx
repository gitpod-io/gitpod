/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { adminMenu } from "./admin-menu";

import { LicenseContext } from "../license-context";
import { ReactElement, useContext } from "react";
import { UserContext } from "../user-context";
import { Redirect } from "react-router-dom";
import { BlackBox, LightBox } from "../components/InfoBox";

import { ReactComponent as Bang } from "../images/exclamation.svg";
import { ReactComponent as Tick } from "../images/tick.svg";

export default function License() {
    // @ts-ignore
    const { license, setLicense } = useContext(LicenseContext);
    const { user } = useContext(UserContext);

    if (!user || !user?.rolesOrPermissions?.includes("admin")) {
        return <Redirect to="/" />;
    }

    const featureList = license?.enabledFeatures;
    const features = license?.features;
    const licenseType = license?.type ? capitalizeInitials(license?.type) : "";

    const userLimit = license?.seats == 0 ? "Unlimited" : license?.seats;
    // const communityLicense = license?.key == "default-license"

    const [licenseLevel, paid, msg, tick] = getSubscriptionLevel(
        license?.plan || "",
        license?.userCount || 0,
        license?.seats || 0,
        false,
    );

    return (
        <div>
            <PageWithSubMenu subMenu={adminMenu} title="License" subtitle="License information of your account.">
                {!license?.valid ? (
                    <p className="text-base text-gray-500 pb-4 max-w-2xl">
                        You do not have a valid license associated with this account. {license?.errorMsg}
                    </p>
                ) : (
                    <div className="flex flex-row space-x-4">
                        <div>
                            <BlackBox>
                                <p className="text-white dark:text-black font-bold pt-4 text-sm"> {licenseLevel}</p>
                                <p className="font-semibold dark:text-gray-500">{paid}</p>
                                <p className="font-semibold text-gray-400 pt-4 pb-2 text-sm">Available features:</p>
                                <div className="pb-4">
                                    {features &&
                                        features.map((feat: string) => (
                                            <div>
                                                {featureList?.includes(feat) ? (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4 inline-block pr-1"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4 inline-block pr-1"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M6 18L18 6M6 6l12 12"
                                                        />
                                                    </svg>
                                                )}
                                                {capitalizeInitials(feat)}
                                            </div>
                                        ))}
                                </div>
                            </BlackBox>
                        </div>
                        <div>
                            <LightBox>
                                <div className="text-gray-600 dark:text-gray-200 font-semibold text-sm flex py-4">
                                    <div>{msg}</div>
                                    <div className="pr-4 pl-1 py-1">{getLicenseValidIcon(tick)}</div>
                                </div>
                                <p className="font-semibold dark:text-gray-500  pt-4 ">Registered Users</p>
                                <h4 className="font-semibold inline-block">
                                    <span className="dark:text-gray-300 pt-1 text-lg">{license.userCount || 0}</span>
                                    <span className="dark:text-gray-500 text-gray-400 pt-1 text-lg">
                                        {" "}
                                        / {userLimit}{" "}
                                    </span>
                                </h4>
                                <p className="font-semibold dark:text-gray-500 pt-2 ">License Type</p>
                                <h4 className="font-semibold dark:text-gray-300 pt-1 text-lg">{licenseType}</h4>
                            </LightBox>
                        </div>
                    </div>
                )}
            </PageWithSubMenu>
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

function getSubscriptionLevel(level: string, userCount: number, seats: number, fallbackAllowed: boolean): string[] {
    switch (level) {
        case "prod": {
            return professionalPlan(userCount, seats);
        }
        case "community": {
            return communityPlan(userCount, seats, fallbackAllowed);
        }
        case "trial": {
            return ["Trial", "Free", "You have a trial license.", "grey-tick"];
        }
        default: {
            return ["Unknown", "Free", "No active licenses.", "red-cross"];
        }
    }
}

function professionalPlan(userCount: number, seats: number): string[] {
    const aboveLimit: boolean = userCount >= seats;
    let msg: string, tick: string;
    if (aboveLimit) {
        msg = "You have reached the usage limit.";
        tick = "red-cross";
    } else {
        msg = "You have an active professional license.";
        tick = "green-tick";
    }

    return ["Professional", "Paid", msg, tick];
}

function communityPlan(userCount: number, seats: number, fallbackAllowed: boolean): string[] {
    const aboveLimit: boolean = userCount >= seats;

    let msg: string = "You are using the free community edition";
    let tick: string = "grey-tick";
    if (aboveLimit) {
        if (fallbackAllowed) {
            msg = "No active license. You are using the community edition.";
        } else {
            msg = "No active license. You have reached your usage limit.";
            tick = "red-cross";
        }
    }

    return ["Community", "Free", msg, tick];
}

function getLicenseValidIcon(iconname: string): ReactElement {
    switch (iconname) {
        case "green-tick":
            return <Tick fill="green"></Tick>;
        case "grey-tick":
            return <Tick fill="gray"></Tick>;
        case "red-cross":
            return <Bang fill="red"></Bang>;
        default:
            return <Bang fill="gray"></Bang>;
    }
}

/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { adminMenu } from "./admin-menu";

import { LicenseContext } from "../license-context";
import { ReactElement, useContext, useEffect } from "react";
import { getGitpodService } from "../service/service";

import { ReactComponent as Alert } from "../images/exclamation.svg";
import { ReactComponent as Success } from "../images/tick.svg";
import { ReactComponent as Tick } from "../images/check.svg";
import { ReactComponent as Cross } from "../images/x.svg";

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
    }, []);

    const featureList = license?.enabledFeatures;
    const features = license?.features;

    // if user seats is 0, it means that there is user limit in the license
    const userLimit = license?.seats == 0 ? "Unlimited" : license?.seats;

    const [licenseLevel, paid, msg, tick] = getSubscriptionLevel(
        license?.plan || "",
        license?.userCount || 0,
        license?.seats || 0,
        license?.fallbackAllowed || false,
    );

    return (
        <div>
            <PageWithSubMenu
                subMenu={adminMenu}
                title="License"
                subtitle="License associated with your Gitpod Installation"
            >
                <div className="flex flex-row space-x-4">
                    <Card className="bg-gray-800 dark:bg-white text-white dark:text-gray-400">
                        <p className="text-white dark:text-black font-bold pt-4 text-sm"> {licenseLevel}</p>
                        <p className="dark:text-gray-500">{paid}</p>
                        <p className="text-gray-400 pt-4 pb-2">Available features:</p>
                        {features &&
                            features.map((feat: string) => (
                                <div className="flex">
                                    {featureList?.includes(feat) ? (
                                        <Tick className="h-4" />
                                    ) : (
                                        <Cross className="h-4 w-4 px-1" />
                                    )}
                                    {capitalizeInitials(feat)}
                                </div>
                            ))}
                    </Card>
                    <Card className="bg-gray-200 dark:bg-gray-900 text-gray-600 dark:text-gray-600">
                        <div className="text-gray-600 dark:text-gray-200 text-sm py-4 flex-row flex items-center">
                            <div>{msg}</div>
                            <div className="px-4">{getLicenseValidIcon(tick)}</div>
                        </div>
                        <p className="dark:text-gray-500">Registered Users</p>
                        <span className="dark:text-gray-300 pt-1 text-lg">{license?.userCount || 0}</span>
                        <span className="dark:text-gray-500 text-gray-400 pt-1 text-lg"> / {userLimit} </span>
                        <p className="dark:text-gray-500 pt-2 ">License Type</p>
                        <h4 className="dark:text-gray-300 pt-1 text-lg">{capitalizeInitials(license?.type || "")}</h4>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                window.location.href = "https://www.gitpod.io/self-hosted";
                            }}
                            className="ml-2 float-right"
                        >
                            {license?.plan == "prod" ? "Contact Sales" : "Request License"}
                        </button>
                    </Card>
                </div>
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
    const aboveLimit: boolean = userCount > seats;
    let msg: string, tick: string;
    if (aboveLimit) {
        msg = "You have exceeded the usage limit.";
        tick = "red-cross";
    } else {
        msg = "You have an active professional license.";
        tick = "green-tick";
    }

    return ["Professional", "Paid", msg, tick];
}

function communityPlan(userCount: number, seats: number, fallbackAllowed: boolean): string[] {
    const aboveLimit: boolean = userCount > seats;

    let msg: string = "You are using the free community edition";
    let tick: string = "green-tick";
    if (aboveLimit) {
        if (fallbackAllowed) {
            msg = "No active license. You are using the community edition.";
            tick = "grey-tick";
        } else {
            msg = "No active license. You have exceeded the usage limit.";
            tick = "red-cross";
        }
    }

    return ["Community", "Free", msg, tick];
}

function getLicenseValidIcon(iconname: string): ReactElement {
    switch (iconname) {
        case "green-tick":
            return <Success fill="green" className="h-8 w-8" />;
        case "grey-tick":
            return <Success fill="gray" className="h-8 w-8" />;
        case "red-cross":
            return <Alert fill="red" className="h-8 w-8" />;
        default:
            return <Alert fill="gray" className="h-8 w-8" />;
    }
}

function isGitpodIo() {
    return window.location.hostname === "gitpod.io" || window.location.hostname === "gitpod-staging.com";
}

function Card(p: { className?: string; children?: React.ReactNode }) {
    return (
        <div className={"flex rounded-xl font-semibold text-xs w-72 h-64 px-4 " + (p.className || "")}>
            <span>{p.children}</span>
        </div>
    );
}

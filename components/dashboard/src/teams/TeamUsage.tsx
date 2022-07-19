/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Redirect, useLocation } from "react-router";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import { BillableSession, BillableWorkspaceType } from "@gitpod/gitpod-protocol/lib/usage";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import moment from "moment";
import Pagination from "../components/Pagination";
import Header from "../components/Header";

function TeamUsage() {
    const { teams } = useContext(TeamsContext);
    const { showUsageBasedUI } = useContext(PaymentContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [billedUsage, setBilledUsage] = useState<BillableSession[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [resultsPerPage] = useState(10);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const attributionId = AttributionId.render({ kind: "team", teamId: team.id });
            const billedUsageResult = await getGitpodService().server.listBilledUsage(attributionId);
            setBilledUsage(billedUsageResult);
        })();
    }, [team]);

    if (!showUsageBasedUI) {
        return <Redirect to="/" />;
    }

    const getType = (type: BillableWorkspaceType) => {
        if (type === "regular") {
            return "Workspace";
        }
        return "Prebuild";
    };

    const getMinutes = (usage: BillableSession) => {
        let end;
        if (!usage.endTime) {
            end = new Date(Date.now()).getTime();
        } else {
            end = new Date(usage.endTime).getTime();
        }
        const start = new Date(usage.startTime).getTime();
        const lengthOfUsage = Math.floor(end - start);
        const inMinutes = (lengthOfUsage / (1000 * 60)).toFixed(1);
        return inMinutes + " min";
    };

    const calculateTotalUsage = () => {
        let totalCredits = 0;
        billedUsage.forEach((session) => (totalCredits += session.credits));
        return totalCredits;
    };

    const lastResultOnCurrentPage = currentPage * resultsPerPage;
    const firstResultOnCurrentPage = lastResultOnCurrentPage - resultsPerPage;
    const numberOfPages = Math.ceil(billedUsage.length / resultsPerPage);
    const currentPaginatedResults = billedUsage.slice(firstResultOnCurrentPage, lastResultOnCurrentPage);

    return (
        <>
            <Header title="Usage" subtitle="Manage team usage." />
            <div className="app-container pt-9">
                <div className="flex space-x-16">
                    <div className="flex">
                        <div className="space-y-8 mb-6" style={{ width: "max-content" }}>
                            <div className="flex flex-col truncate">
                                <div className="text-base text-gray-500 truncate">Period</div>
                                <div className="text-lg text-gray-600 font-semibold truncate">June 2022</div>
                            </div>
                            <div className="flex flex-col truncate">
                                <div className="text-base text-gray-500">Total usage</div>
                                <div className="flex text-lg text-gray-600 font-semibold">
                                    <svg
                                        className="my-auto mr-1"
                                        width="20"
                                        height="20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M5 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm5.2 11.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
                                            fill="url(#a)"
                                        />
                                        <defs>
                                            <linearGradient
                                                id="a"
                                                x1="4.3"
                                                y1="4.3"
                                                x2="16.071"
                                                y2="17.107"
                                                gradientUnits="userSpaceOnUse"
                                            >
                                                <stop stop-color="#FFAD33" />
                                                <stop offset="1" stop-color="#FF8A00" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <span>{calculateTotalUsage()} Total Credits</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col w-full mb-8">
                        <h3>All Usage</h3>
                        <span className="text-gray-500 mb-5">View usage details of all team members.</span>
                        <ItemsList className="mt-2 text-gray-500">
                            <Item header={false} className="grid grid-cols-5 bg-gray-100 mb-5">
                                <ItemField className="my-auto">
                                    <span>Type</span>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <span>Class</span>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <span>Usage</span>
                                </ItemField>
                                <ItemField className="flex my-auto">
                                    <svg
                                        className="my-auto mr-1"
                                        width="20"
                                        height="20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            clip-rule="evenodd"
                                            d="M5 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm5.2 11.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
                                            fill="url(#a)"
                                        />
                                        <defs>
                                            <linearGradient
                                                id="a"
                                                x1="4.3"
                                                y1="4.3"
                                                x2="16.071"
                                                y2="17.107"
                                                gradientUnits="userSpaceOnUse"
                                            >
                                                <stop stop-color="#FFAD33" />
                                                <stop offset="1" stop-color="#FF8A00" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <span>Credits</span>
                                </ItemField>
                                <ItemField className="my-auto" />
                            </Item>
                            {currentPaginatedResults.map((usage) => (
                                <div
                                    key={usage.instanceId}
                                    className="flex p-3 grid grid-cols-5 justify-between transition ease-in-out rounded-xl focus:bg-gitpod-kumquat-light"
                                >
                                    <div className="my-auto">
                                        <span>{getType(usage.workspaceType)}</span>
                                    </div>
                                    <div className="my-auto">
                                        <span className="text-gray-400">{usage.workspaceClass}</span>
                                    </div>
                                    <div className="my-auto">
                                        <span className="text-gray-700">{getMinutes(usage)}</span>
                                    </div>
                                    <div className="my-auto">
                                        <span className="text-gray-700">{usage.credits.toFixed(1)}</span>
                                    </div>
                                    <div className="my-auto">
                                        <span className="text-gray-400">
                                            {moment(new Date(usage.startTime).toDateString()).fromNow()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </ItemsList>
                        {billedUsage.length > resultsPerPage && (
                            <Pagination
                                currentPage={currentPage}
                                setCurrentPage={setCurrentPage}
                                numberOfPages={numberOfPages}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default TeamUsage;

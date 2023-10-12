/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import dayjs from "dayjs";
import { PrebuildEvent } from "@gitpod/gitpod-protocol";
import { useCallback, useEffect, useState } from "react";
import Header from "../components/Header";
import { ItemsList, Item, ItemField } from "../components/ItemsList";
import { getGitpodService } from "../service/service";
import Spinner from "../icons/Spinner.svg";
import NoAccess from "../icons/NoAccess.svg";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { openAuthorizeWindow } from "../provider-utils";
import { useCurrentProject } from "./project-context";
import { toRemoteURL } from "./render-utils";
import { Redirect } from "react-router";
import { Subheading } from "../components/typography/headings";

export default function EventsPage() {
    const { project, loading } = useCurrentProject();

    const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
    const [events, setEvents] = useState<PrebuildEvent[]>([]);

    const [searchFilter, setSearchFilter] = useState<string | undefined>();

    const [showAuthBanner, setShowAuthBanner] = useState<{ host: string } | undefined>(undefined);

    const updatePrebuildEvents = useCallback(async () => {
        if (!project) {
            return;
        }
        setIsLoadingEvents(true);
        try {
            const events = await getGitpodService().server.getPrebuildEvents(project.id);
            setEvents(events);
        } finally {
            setIsLoadingEvents(false);
        }
    }, [project]);

    useEffect(() => {
        if (!project) {
            return;
        }
        (async () => {
            try {
                await updatePrebuildEvents();
            } catch (error) {
                if (error && error.code === ErrorCodes.NOT_AUTHENTICATED) {
                    setShowAuthBanner({ host: new URL(project.cloneUrl).hostname });
                } else {
                    console.error("Getting events failed", error);
                }
            }
        })();
    }, [project, updatePrebuildEvents]);

    const tryAuthorize = async (host: string, onSuccess: () => void) => {
        try {
            await openAuthorizeWindow({
                host,
                onSuccess,
                onError: (error) => {
                    console.log(error);
                },
            });
        } catch (error) {
            console.log(error);
        }
    };

    const onConfirmShowAuthModal = async (host: string) => {
        setShowAuthBanner(undefined);
        await tryAuthorize(host, async () => {
            // update remote session
            await getGitpodService().reconnect();

            // retry fetching events
            updatePrebuildEvents().catch((e) => console.log(e));
        });
    };

    const filter = (event: PrebuildEvent) => {
        if (
            searchFilter &&
            `${formatDate(event.creationTime)} ${event.commit} ${event.branch}`
                .toLowerCase()
                .includes(searchFilter.toLowerCase()) === false
        ) {
            return false;
        }
        return true;
    };

    const formatDate = (date: string | undefined) => {
        return date ? dayjs(date).fromNow() : "";
    };

    const renderStatus = (event: PrebuildEvent) => {
        return event.status;
    };

    if (!loading && !project) {
        return <Redirect to="/projects" />;
    }

    return (
        <>
            <Header
                title="Prebuild Events"
                subtitle={
                    <Subheading tracking="wide">
                        View recent prebuild events for{" "}
                        <a className="gp-link" href={project?.cloneUrl!}>
                            {toRemoteURL(project?.cloneUrl || "")}
                        </a>
                        .
                    </Subheading>
                }
            />
            <div className="app-container">
                {showAuthBanner ? (
                    <div className="mt-8 rounded-xl text-gray-500 bg-gray-50 dark:bg-gray-800 flex-col">
                        <div className="p-8 text-center">
                            <img src={NoAccess} alt="" title="No Access" className="m-auto mb-4" />
                            <div className="text-center text-gray-600 dark:text-gray-50 pb-3 font-bold">No Access</div>
                            <div className="text-center dark:text-gray-400 pb-3">
                                Authorize {showAuthBanner.host} <br />
                                to access project information.
                            </div>
                            <button
                                className={`primary mr-2 py-2`}
                                onClick={() => onConfirmShowAuthModal(showAuthBanner.host)}
                            >
                                Authorize Provider
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex mt-8">
                            <div className="flex">
                                <div className="py-4">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 16 16"
                                        width="16"
                                        height="16"
                                    >
                                        <path
                                            fill="#A8A29E"
                                            d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                                        />
                                    </svg>
                                </div>
                                <input
                                    type="search"
                                    placeholder="Search Recent Events"
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                />
                            </div>
                            <div className="flex-1" />
                        </div>
                        <ItemsList className="mt-2">
                            <Item header={true} className="grid grid-cols-3">
                                <ItemField className="my-auto">
                                    <span>Time</span>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <span>Commit</span>
                                </ItemField>
                                <ItemField className="my-auto">
                                    <span>Prebuild Status</span>
                                </ItemField>
                            </Item>
                            {isLoadingEvents && (
                                <div className="flex items-center justify-center space-x-2 text-gray-400 text-sm pt-16 pb-40">
                                    <img className="h-4 w-4 animate-spin" src={Spinner} alt="loading spinner" />
                                    <span>Fetching Prebuild Events...</span>
                                </div>
                            )}
                            {events
                                .filter(filter)
                                .slice(0, 10)
                                .map((event, index) => {
                                    const status = renderStatus(event);

                                    return (
                                        <Item key={`event-${index}-${event.id}`} className="grid grid-cols-3 group">
                                            <ItemField className="flex items-center my-auto">
                                                <div className="truncate">
                                                    <p>{formatDate(event.creationTime)}</p>
                                                </div>
                                            </ItemField>
                                            <ItemField className="flex items-center my-auto">
                                                <div className="truncate">
                                                    <div className="text-base text-gray-500 dark:text-gray-50 font-medium mb-1 truncate">
                                                        {event?.branch}
                                                    </div>
                                                    <p>{event?.commit?.substring(0, 8)}</p>
                                                </div>
                                            </ItemField>
                                            <ItemField className="flex items-center my-auto">
                                                {event.prebuildId && (
                                                    <a
                                                        className="text-base text-gray-900 dark:text-gray-50 font-medium uppercase mb-1 cursor-pointer"
                                                        href={`/projects/${project?.id || ""}/${event.prebuildId}`}
                                                    >
                                                        {status}
                                                    </a>
                                                )}
                                                {!event.prebuildId && (
                                                    <div className="truncate">
                                                        <div className="text-base text-gray-500 dark:text-gray-50 font-medium uppercase mb-1 truncate">
                                                            {status}
                                                        </div>
                                                        <p>{event?.message}</p>
                                                    </div>
                                                )}
                                            </ItemField>
                                        </Item>
                                    );
                                })}
                        </ItemsList>
                    </>
                )}
            </div>
            <div></div>
        </>
    );
}

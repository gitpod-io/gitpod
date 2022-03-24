/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useCallback } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import SelectableCard from "../components/SelectableCard";
import CheckBox from "../components/CheckBox";
import settingsMenu from "./settings-menu";
import { useLabsStorage } from "./LabsStorage";

export default function Labs() {
    const [labsStore, setLabsStore] = useLabsStorage();

    const { makeIt } = labsStore;

    const setMakeIt = useCallback(
        (v) => {
            setLabsStore({ makeIt: v });
        },
        [setLabsStore],
    );

    return (
        <div>
            <PageWithSubMenu subMenu={settingsMenu} title="Labs" subtitle="On the cutting edge.">
                <h3>Make it</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">Personal.</p>
                <div className="my-4 gap-4 flex flex-wrap max-w-2xl">
                    <SelectableCard
                        className="w-48 h-32"
                        title="Default"
                        selected={makeIt === "default"}
                        onClick={() => setMakeIt("default")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#C4C4C4" rx="8" />
                                <rect width="32" height="16" fill="#C4C4C4" rx="8" />
                                <rect width="32" height="16" y="24" fill="#C4C4C4" rx="8" />
                                <rect width="32" height="16" y="48" fill="#C4C4C4" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Classic"
                        selected={makeIt === "classic"}
                        onClick={() => setMakeIt("classic")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Gay"
                        selected={makeIt === "gay"}
                        onClick={() => setMakeIt("gay")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Pawquat"
                        selected={makeIt === "pawquat"}
                        onClick={() => setMakeIt("pawquat")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Aussie"
                        selected={makeIt === "aussie"}
                        onClick={() => setMakeIt("aussie")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Bri'ish"
                        selected={makeIt === "british"}
                        onClick={() => setMakeIt("british")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="90s"
                        selected={makeIt === "terrible"}
                        onClick={() => setMakeIt("terrible")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Anime UwU"
                        selected={makeIt === "anime"}
                        onClick={() => setMakeIt("anime")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="White Label"
                        selected={makeIt === "whitelabel"}
                        onClick={() => setMakeIt("whitelabel")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Accessible"
                        selected={makeIt === "accessible"}
                        onClick={() => setMakeIt("accessible")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Greek"
                        selected={makeIt === "greek"}
                        onClick={() => setMakeIt("greek")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Dance 💃"
                        selected={makeIt === "dance"}
                        onClick={() => setMakeIt("dance")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Turbo"
                        selected={makeIt === "turbo"}
                        onClick={() => setMakeIt("turbo")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                    <SelectableCard
                        className="w-48 h-32"
                        title="Compliant"
                        selected={makeIt === "compliant"}
                        onClick={() => setMakeIt("compliant")}
                    >
                        <div className="flex-grow flex justify-center items-end">
                            <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64">
                                <rect width="68" height="40" x="40" fill="#737373" rx="8" />
                                <rect width="32" height="16" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="24" fill="#737373" rx="8" />
                                <rect width="32" height="16" y="48" fill="#737373" rx="8" />
                            </svg>
                        </div>
                    </SelectableCard>
                </div>
                <h3>GitHub Codespaces</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">
                    Unlock the Codespaces beta waitlist to get a cloud development environment you can access from
                    anywhere.
                </p>

                <CheckBox
                    title="Skip the GitHub Codespaces beta waitlist"
                    desc="We’d love to hear your feedback while you’re trying this new feature.

                    "
                    checked={makeIt === "codespaces"}
                    onChange={() => setMakeIt("codespaces")}
                />
            </PageWithSubMenu>
        </div>
    );
}

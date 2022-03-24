/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { useState, useContext, useCallback, useEffect } from "react";
import owoify from "owoifyx";

const uwuObserver = new MutationObserver((mutationList) => {
    uwuOff();
    mutationList.forEach((mutation) => {
        if (true) {
            const target = mutation.target as Text;
            if (target.nodeType === Node.TEXT_NODE || true) {
                target.nodeValue = owoify(target.nodeValue || "");
            }
        }
    });
    uwuOn();
});

const uwuOn = () => {
    uwuObserver.observe(document.getElementById("root")!, {
        subtree: true,
        characterData: true,
    });
};

const uwuOff = () => {
    uwuObserver.disconnect();
};

const defaultState = {
    makeIt: "default",
};

const LabsStorageContext = React.createContext([defaultState, (value: any) => {}] as const);

export const useLabsStorage = () => {
    const [store, setStore] = useContext(LabsStorageContext);
    return [store as typeof defaultState, setStore as (v: typeof defaultState) => void] as const;
};

export const LabsStorageProvider = (props: { children: React.ReactNode }) => {
    const savedState = localStorage.getItem("labs-storage");
    const [store, setStore] = useState<typeof defaultState>(
        savedState === null ? defaultState : JSON.parse(savedState),
    );

    const saveStore = useCallback(
        (value) => {
            localStorage.setItem("labs-storage", JSON.stringify(value));
            setStore(value);
        },
        [setStore],
    );

    useEffect(() => {
        if (store.makeIt === "anime") {
            uwuOn();
            return () => {
                uwuOff();
            };
        }
    }, [store.makeIt]);

    useEffect(() => {
        document.body.classList.add("makeit-" + store.makeIt);
        return () => {
            document.body.classList.remove("makeit-" + store.makeIt);
        };
    }, [store.makeIt]);

    return (
        <LabsStorageContext.Provider value={[store, saveStore]}>
            {props.children}
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                    body.makeit-gay::before {
                        z-index: -1000000;
                        content: "";
                        position: fixed;
                        top: -100%;
                        left: -100%;
                        width: 300%;
                        height: 300%;
                        background: linear-gradient(180deg, #181818 12.5%,
                            #784F17 12.5%, 25%, #FE0000 25%, 37.5%,
                            #FD8C00 37.5%, 50%, #FFE500 50%, 62.5%,
                            #119F0B 62.5%, 75%, #0644B3 75%, 87.5%,
                            #C22EDC 87.5%);
                        opacity: 0.4;
                        animation: spin 3s linear infinite;
                    }

                    @keyframes spin {
                        100% {transform: rotate(360deg);}
                    }

                    body.makeit-terrible * {
                        font-family: "Comic Sans MS", "Comic Sans", cursive !important;
                    }

                    body.makeit-terrible h1, body.makeit-terrible h2 {
                        animation: marquee 5s linear infinite;
                    }

                    @keyframes marquee {
                        0% { transform: translateX(100%); }
                        100% { transform: translateX(-100%); }
                    }

                    body.makeit-terrible h3, body.makeit-terrible h4 {
                        animation: 2s linear infinite condemned_blink_effect;
                    }

                    @keyframes condemned_blink_effect {
                        0% {
                          visibility: hidden;
                        }
                        50% {
                          visibility: hidden;
                        }
                        100% {
                          visibility: visible;
                        }
                    }

                    body.makeit-accessible * {
                        filter: url(./../images/colorblind.svg#protanopia);
                    }

                    body.makeit-anime {
                        background-color: #ffc0d3;
                    }
                `,
                }}
            />
        </LabsStorageContext.Provider>
    );
};

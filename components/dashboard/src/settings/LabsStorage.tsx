import React, { useState, useContext, useCallback, useEffect } from "react";
import owoify from "owoifyx";

const uwuObserver = new MutationObserver((mutationList) => {
    mutationList.forEach((mutation) => {
        if (mutation.type === "characterData") {
            const target = mutation.target as HTMLElement;
            if (target.nodeType === Node.TEXT_NODE) {
                target.innerText = owoify(target.innerText);
            }
        }
    });
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

    return <LabsStorageContext.Provider value={[store, saveStore]}>{props.children}</LabsStorageContext.Provider>;
};

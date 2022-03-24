import React, { useState, useContext, useCallback } from "react";

const defaultState = {
    makeIt: "default",
};

const LabsStorageContext = React.createContext([defaultState, () => {}]);

export const useLabsStorage = () => {
    const [store, setStore] = useContext(LabsStorageContext);
    return [store as typeof defaultState, setStore as (v: typeof defaultState) => void] as const;
};

export const LabsStorageProvider = (props: { children: React.ReactNode }) => {
    const savedState = localStorage.getItem("labs-storage");
    const [store, setStore] = useState(savedState === null ? defaultState : JSON.parse(savedState));

    const saveStore = useCallback(
        (value) => {
            localStorage.setItem("labs-storage", JSON.stringify(value));
            setStore(value);
        },
        [setStore],
    );

    return <LabsStorageContext.Provider value={[store, saveStore]}>{props.children}</LabsStorageContext.Provider>;
};

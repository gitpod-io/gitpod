import { useState } from "react";

export default function Modal(props: {
    children: React.ReactChild[] | React.ReactChild,
    visible: boolean,
    closeable?: boolean,
    onClose?: () => void
}) {
    const [visible, setVisible] = useState(props.visible);
    const hide = () => setVisible(false);
    if (!visible) {
        return null;
    }
    return (
        <div className="absolute top-0 left-0 bg-black bg-opacity-40 z-50 w-screen h-screen" >
            <div className="bg-transparent h-1/3" />
            <div className="bg-white rounded-md px-6 py-4 max-w-lg mx-auto">
                {props.closeable !== false && (
                    <div className="float-right cursor-pointer" onClick={hide}>&#10006;</div>
                )}

                {props.children}
            </div>
        </div>
    );
}
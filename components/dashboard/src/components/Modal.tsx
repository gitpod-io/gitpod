import { Disposable, DisposableCollection } from "@gitpod/gitpod-protocol";
import { useEffect } from "react";

export default function Modal(props: {
    children: React.ReactChild[] | React.ReactChild,
    visible: boolean,
    closeable?: boolean,
    className?: string,
    onClose: () => void,
    onEnter?: () => boolean
}) {
    const disposable = new DisposableCollection();
    const close = () => {
        disposable.dispose();
        props.onClose();
    }
    useEffect(() => {
        if (!props.visible) {
            return;
        }
        const keyHandler = (k: globalThis.KeyboardEvent) => {
            if (k.eventPhase === 1 /* CAPTURING */) {
                if (k.key === 'Escape') {
                    close();
                }
                if (k.key === 'Enter') {
                    if (props.onEnter) {
                        if (props.onEnter() === false) {
                            return;
                        }
                    }
                    close();
                    k.stopPropagation();
                }
            }
        }
        window.addEventListener('keydown', keyHandler, { capture: true });
        disposable.push(Disposable.create(()=> window.removeEventListener('keydown', keyHandler)));
    });
    if (!props.visible) {
        return null;
    }
    return (
        <div className="fixed top-0 left-0 bg-black bg-opacity-70 z-50 w-screen h-screen" onClick={close}>
            <div className="w-screen h-screen align-middle" style={{display: 'table-cell'}}>
                <div className={"relative bg-white border rounded-xl p-6 max-w-lg mx-auto text-gray-600" + props.className} onClick={e => e.stopPropagation()}>
                    {props.closeable !== false && (
                        <div className="absolute right-7 top-6 cursor-pointer hover:bg-gray-200 rounded-md p-2" onClick={close}>
                            <svg version="1.1" width="14px" height="14px"
                                viewBox="0 0 100 100">
                                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="10px" />
                                <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="10px" />
                            </svg>
                        </div>
                    )}
                    {props.children}
                </div>
            </div>
        </div>
    );
}
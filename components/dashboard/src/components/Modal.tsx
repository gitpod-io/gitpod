export default function Modal(props: {
    children: React.ReactChild[] | React.ReactChild,
    visible: boolean,
    closeable?: boolean,
    className?: string,
    onClose: () => void
}) {
    if (!props.visible) {
        return null;
    }
    setTimeout(() => window.addEventListener('click', props.onClose, { once: true }), 0);
    return (
        <div className="fixed top-0 left-0 bg-black bg-opacity-70 z-50 w-screen h-screen" >
            <div className="w-screen h-screen align-middle" style={{display: 'table-cell'}}>
                <div className={"relative bg-white border rounded-xl p-6 max-w-lg mx-auto text-gray-600" + props.className}>
                    {props.closeable !== false && (
                        <div className="absolute right-9 top-8 cursor-pointer" onClick={props.onClose}>
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
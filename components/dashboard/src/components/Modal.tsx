export default function Modal(props: {
    children: React.ReactChild[] | React.ReactChild,
    visible: boolean,
    closeable?: boolean,
    onClose: () => void
}) {
    if (!props.visible) {
        return null;
    }
    setTimeout(() => window.addEventListener('click', props.onClose, {once: true}), 0);
    return (
        <div className="fixed top-0 -left-2 bg-black bg-opacity-70 z-50 w-screen h-screen" >
            <div className="bg-transparent h-1/3" />
            <div className="bg-white border rounded-xl p-6 max-w-lg mx-auto">
                {props.closeable !== false && (
                    <div className="float-right cursor-pointer" onClick={props.onClose}>&#10006;</div>
                )}
                {props.children}
            </div>
        </div>
    );
}
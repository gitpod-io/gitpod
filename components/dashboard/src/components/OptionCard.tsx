export interface OptionCardProps {
    title: string;
    selected: boolean;
    className?: string;
    onClick: () => void;
    children?: React.ReactNode;
}

function OptionCard(props: OptionCardProps) {
    return <div className={`rounded-xl px-4 py-3 flex flex-col group border-2 ${props.selected ? 'border-green-600' : 'border-gray-300 hover:border-gray-400'} ${props.className || ''}`} onClick={props.onClick}>
        <div className="flex items-center">
            <p className={`w-full text-base font-semibold ${props.selected ? 'text-green-600' : 'text-gray-300 group-hover:text-gray-400'}`}>{props.title}</p>
            <input type="radio" checked={props.selected} />
        </div>
        {props.children}
    </div>;
}

export default OptionCard;

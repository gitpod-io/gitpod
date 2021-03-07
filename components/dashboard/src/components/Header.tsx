import Separator from "./Separator";

export interface HeaderProps {
    title: string;
    subtitle: string;
}

export default function Header(p: HeaderProps) {
    return <div className="lg:px-28 px-10 border-gray-200">
        <div className="flex py-8">
            <div className="">
                <h1 className="">{p.title}</h1>
                <h2 className="pt-1">{p.subtitle}</h2>
            </div>
        </div>
        <Separator />
    </div>;
}
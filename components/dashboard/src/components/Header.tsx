import Separator from "./Separator";
import { SubMenuEntry } from "./SubMenu";

export interface HeaderProps {
    title: string;
    subtitle: string;
    tabs?: SubMenuEntry[];
}

export default function Header(p: HeaderProps) {
    return <div className="lg:px-28 px-10 border-gray-200">
        <div className="flex py-10">
            <div className="">
                <h1>{p.title}</h1>
                <h2 className="pt-1">{p.subtitle}</h2>
            </div>
        </div>
        <Separator />
    </div>;
}
import Header from './Header';
import { SubMenu, SubMenuEntry } from './SubMenu';

export interface Props {
    title: string;
    subtitle: string;
    menuEntries: SubMenuEntry[];
    children: React.ReactNode;
}

export function SettingsPage(p: Props) {
    return <div>
        <Header title={p.title} subtitle={p.subtitle}/>
        <div className='lg:px-28 px-10 flex pt-9'>
            <SubMenu entries={p.menuEntries} />
            <div className='ml-5 pl-12 w-full pt-1'>
                {p.children}
            </div>
        </div>
    </div>;
}
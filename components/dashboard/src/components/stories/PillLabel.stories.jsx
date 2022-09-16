import PillLabel from "../PillLabel";

export default {
    title: "Components/PillLabel",
    component: PillLabel,
};

const Default = args => <PillLabel {...args}/>;

export const Info = Default.bind({})
Info.args = {
    type: "info",
    children: ""
}

export const Warn = Default.bind({})
Warn.args = {
    type: "warn",
    children: "Beta"
}

import { Fragment, useState, useMemo } from "react";
import { JsonForms } from "@jsonforms/react";
import Button from "@mui/material/Button";
import "./App.css";
import schema from "./schema.json";
import uischema from "./uischema.json";

import rootSAEverything from "./examples/root-sa-everything.json";
import allTeamMembersCantShare from "./examples/all-team-members-cant-share-ws.json";
import saListsPrjPrebuilds from "./examples/sa-lists-prj-prebuilds.json";
import saReadAccrossPrj from "./examples/sa-read-access-all-projects.json";
import userCanCreateWorkspace from "./examples/user-can-create-workspace.json";
import userPbAccessRepo from "./examples/user-pb-access-through-repo.json";

import { materialCells, materialRenderers } from "@jsonforms/material-renderers";
import RatingControl from "./RatingControl";
import ratingControlTester from "./ratingControlTester";
import { makeStyles } from "@mui/styles";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import { MenuItem, Select, SelectChangeEvent } from "@mui/material";

const examples = [
    { desc: "root SA can access everything", spec: rootSAEverything },
    { desc: "all team members can't share WS for project", spec: allTeamMembersCantShare },
    { desc: "SA lists project prebuilds", spec: saListsPrjPrebuilds },
    { desc: "SA reads accross projects", spec: saReadAccrossPrj },
    { desc: "user can create workspace", spec: userCanCreateWorkspace },
    { desc: "user can use prebuild with repo access", spec: userPbAccessRepo },
];

const useStyles = makeStyles({
    container: {
        padding: "1em",
        width: "100%",
    },
    title: {
        textAlign: "center",
        padding: "0.25em",
    },
    dataContent: {
        display: "flex",
        justifyContent: "center",
        borderRadius: "0.25em",
        backgroundColor: "#cecece",
        marginBottom: "1rem",
    },
    resetButton: {
        margin: "auto !important",
        display: "block !important",
    },
    demoform: {
        margin: "auto",
        padding: "1rem",
    },
});

const initialData = examples[0].spec;

const renderers = [
    ...materialRenderers,
    //register custom renderers
    { tester: ratingControlTester, renderer: RatingControl },
];

const App = () => {
    const classes = useStyles();
    const [data, setData] = useState<any>(initialData);
    const stringifiedData = useMemo(() => JSON.stringify(data, null, 2), [data]);

    const clearData = () => {
        setData({});
    };

    const [example, setExample] = useState<string>("0");
    const [response, setResponse] = useState<ResponseLine[]>();

    const handleSetExample = (event: SelectChangeEvent) => {
        const id = parseInt(event.target.value);
        setExample(event.target.value);
        setData(examples[id].spec);
        setResponse(undefined);
    };

    interface ResponseLine {
        description: string;
        correct: boolean;
    }


    const submit = async () => {
        const resp = await fetch(window.location.href + "authenticator.v1.EvalService/CleanSlateEval", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(data),
            redirect: "manual",
        });

        const results = await resp.json();
        setResponse(results.results);
    };

    return (
        <Fragment>
            <div className={classes.demoform}>
                Example:
                <Select label="Example" onChange={handleSetExample} value={example}>
                    {examples.map((e, i) => {
                        const res = (
                            <MenuItem key={i} value={i}>
                                {e.desc}
                            </MenuItem>
                        );
                        return res;
                    })}
                </Select>
                <hr />
                <JsonForms
                    schema={schema}
                    uischema={uischema}
                    data={data}
                    renderers={renderers}
                    cells={materialCells}
                    onChange={({ errors, data }) => setData(data)}
                />
                <Accordion>
                    <AccordionSummary>Raw JSON</AccordionSummary>
                    <AccordionDetails>
                        <div className={classes.dataContent}>
                            <pre id="boundData">{stringifiedData}</pre>
                        </div>
                    </AccordionDetails>
                </Accordion>
                <hr />
                <Button variant="contained" onClick={submit}>
                    Submit
                </Button>
                <ul>
                    {response?.map((e, i) => (
                        <li key={i}>
                            {e.correct ? "✅" : "❌"} {e.description}
                        </li>
                    ))}
                </ul>
            </div>
        </Fragment>
    );
};

export default App;

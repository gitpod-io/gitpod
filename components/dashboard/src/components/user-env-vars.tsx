/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { User, GitpodService, UserEnvVarValue } from "@gitpod/gitpod-protocol";
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import Typography from '@material-ui/core/Typography';
import Delete from '@material-ui/icons/Delete';
import Edit from '@material-ui/icons/Edit';
import Check from '@material-ui/icons/Check';
import Cancel from '@material-ui/icons/Cancel';
import Info from '@material-ui/icons/Info';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import Tooltip from '@material-ui/core/Tooltip';
import Button from '@material-ui/core/Button';

export class UserEnvVarsProps {
    service: GitpodService;
    user?: User;
}

export class UserEnvVarsState {
    envVars: UserEnvVarValue[];
    exampleOwner?: string;
}

export class UserEnvVars extends React.Component<UserEnvVarsProps, UserEnvVarsState> {

    constructor(props: UserEnvVarsProps) {
        super(props);

        this.state = { envVars: [] };
    }

    componentWillMount() {
        this.update();
    }


    componentDidUpdate(prevProps: UserEnvVarsProps) {
        if (this.props.user !== prevProps.user) {
            if (this.props.user) {
                this.setState({ exampleOwner: this.props.user.name });
            }
        }
    }

    protected async update() {
        const envVars = await this.props.service.server.getEnvVars({});
        this.setState({
            envVars: envVars.sort((a, b) => a.name.localeCompare(b.name))
        });
    }

    protected deleteEnvVar = async (envVar: UserEnvVarValue) => {
        await this.props.service.server.deleteEnvVar({variable: envVar});
        this.update();
    };

    protected updateEnvVar = async (oldEnv: UserEnvVarValue, newEnv: UserEnvVarValue) => {
        await this.props.service.server.setEnvVar({variable: newEnv});
        this.update();
    };

    protected addEnvVar = async () => {
        if (!this.props.user) {
            return;
        }

        let i = this.state.envVars.length + 1;
        let name = `VARIABLE${i}`;
        while (this.state.envVars.find(v => v.name === name)) {
            i++;
            name = `VARIABLE${i}`;
        }

        await this.props.service.server.setEnvVar({
            variable: {
                name,
                value: 'my value',
                repositoryPattern: `*/*`
            }
        });
        this.update();
    };

    render() {
        const exampleOwner = this.state.exampleOwner || "gitpod-io";

        return <React.Fragment>
            {
                this.state.envVars.length > 0 &&
                <Table style={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell style={{ width: "auto" }}>Name</TableCell>
                            <TableCell style={{ width: "auto" }}>Value</TableCell>
                            <TableCell style={{ width: "auto" }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div>Organization/Repository</div>
                                    <Tooltip leaveDelay={1000} placement="top" style={{ margin: 5 }}
                                        title={`Determines for what repositories a variable should be injected. Examples: \n'${exampleOwner}/*' means all of your repositories. \n'*/react' all repositories named react. \n'*/*' any repository. Partial wildcards (e.g. '${exampleOwner}/react-*') are not supported.`}>
                                        <Info fontSize="small" color="disabled" style={{ verticalAlign: 'middle' }} />
                                    </Tooltip>
                                </div>
                            </TableCell>
                            <TableCell style={{ width: 106, padding: 4 }}></TableCell>
                        </TableRow>
                    </TableHead>
                    {this.state.envVars.map(envVar => {
                        return <UserEnvVarComponent key={this.computeKey(envVar)} envVar={envVar} envVars={this.state.envVars} delete={this.deleteEnvVar} update={this.updateEnvVar} />;
                    })}
                </Table>
            }
            {this.state.envVars.length < 1 &&
                <Typography variant="body1" style={{ width: "100%" }}>You do not have any environment variables. Click on “Add Variable” to add one.</Typography>
            }
            <div style={{ marginTop: "1.5em" }}>
                <Button onClick={this.addEnvVar} color="secondary" variant="outlined">Add Variable</Button>
            </div>
        </React.Fragment>;
    }

    private computeKey(envVar: UserEnvVarValue) {
        return envVar.name + envVar.value + envVar.repositoryPattern;
    }
}

class UserEnvVarComponentProps {
    envVar: UserEnvVarValue;
    envVars: UserEnvVarValue[];
    delete: (envVar: UserEnvVarValue) => void;
    update: (oldVar: UserEnvVarValue, newVar: UserEnvVarValue) => void;
}

class UserEnvVarState {
    isEditing: boolean;
    currentName: string;
    currentValue: string;
    currentRepoPattern: string;
}

class UserEnvVarComponent extends React.Component<UserEnvVarComponentProps, UserEnvVarState> {

    constructor(props: UserEnvVarComponentProps) {
        super(props);

        this.save = this.save.bind(this);
        this.delete = this.delete.bind(this);
        this.validateName = this.validateName.bind(this);
        this.validateRepoPattern = this.validateRepoPattern.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.reset = this.reset.bind(this);
        this.toggleEditing = this.toggleEditing.bind(this);
        this.canSave = this.canSave.bind(this);

        this.state = {
            currentName: this.props.envVar.name,
            currentValue: this.props.envVar.value,
            currentRepoPattern: this.props.envVar.repositoryPattern,
            isEditing: false
        };
    }

    protected async save() {
        if (this.canSave()) {
            const newProps = {
                ... this.props.envVar,
                name: this.state.currentName,
                value: this.state.currentValue,
                repositoryPattern: this.state.currentRepoPattern,
            }
            await this.props.update(this.props.envVar, newProps);
            this.setState({ isEditing: false });
        }
    };

    protected delete() {
        this.props.delete(this.props.envVar);
    }

    protected validateName(name: string) {
        if (name.trim() === '') {
            return 'Must not be empty.';
        }
        if (!/^[a-zA-Z0-9_]*$/.test(name)) {
            return 'Must match /[a-zA-Z_]+[a-zA-Z0-9_]*/.';
        }
        // Don't allow duplicate variables (same name && same scope)
        if (this.props.envVars.find(v =>
            v.name === name &&
            v.repositoryPattern === this.state.currentRepoPattern &&
            v !== this.props.envVar)) {
            return 'Variable already exists.';
        }
        return '';
    }

    protected validateRepoPattern(pattern: string) {
        if (pattern.trim() === '') {
            return 'Must not be empty.';
        }
        const split = pattern.split('/');
        if (split.length < 2) {
            return "Please use the form 'organization/repo'.";
        }
        for (const name of split) {
            if (name !== '*') {
                if (!/^[a-zA-Z0-9_\-.\*]+$/.test(name)) {
                    return 'Invalid name segment. Only ASCII characters, numbers, -, _, . or * are allowed.';
                }
            }
        }
        // Don't allow duplicate variables (same name && same scope)
        if (this.props.envVars.find(v =>
            v.name === this.state.currentName &&
            v.repositoryPattern === pattern &&
            v !== this.props.envVar)) {
            return 'Variable already exists.';
        }
        return '';
    }

    protected handleKeyUp(e: React.KeyboardEvent<HTMLElement>) {
        if (e.key === "Enter") {
            this.save();
        } else if (e.key === "Escape") {
            this.reset();
        }
    }

    protected reset() {
        this.setState({
            currentName: this.props.envVar.name,
            currentValue: this.props.envVar.value,
            currentRepoPattern: this.props.envVar.repositoryPattern,
            isEditing: false
        });
    }

    protected toggleEditing() {
        this.setState({
            isEditing: !this.state.isEditing
        });
    }

    protected readonly updateName = (newName: string) => this.setState({ currentName: newName });
    protected readonly updateValue = (newValue: string) => this.setState({ currentValue: newValue });
    protected readonly updateRepositoryPattern = (newPattern: string) => this.setState({ currentRepoPattern: newPattern });

    protected canSave() {
        return !this.validateName(this.state.currentName) && !this.validateRepoPattern(this.state.currentRepoPattern);
    }

    render() {
        return <TableRow onKeyUp={this.handleKeyUp}>
            <TableCell style={{ paddingRight: 4 }}>
                <EditableLabel
                    autofocus={true}
                    label={this.state.currentName}
                    onChange={this.updateName}
                    errorMessage={this.validateName(this.state.currentName)}
                    maxlength={255}
                    onClick={this.toggleEditing}
                    isEditing={this.state.isEditing} />
            </TableCell>
            <TableCell style={{ paddingRight: 4 }}>
                <EditableLabel
                    label={this.state.currentValue}
                    onChange={this.updateValue}
                    onClick={this.toggleEditing}
                    isEditing={this.state.isEditing} />
            </TableCell>
            <TableCell style={{ paddingRight: 4 }}>
                <EditableLabel
                    label={this.state.currentRepoPattern}
                    onChange={this.updateRepositoryPattern}
                    errorMessage={this.validateRepoPattern(this.state.currentRepoPattern)}
                    maxlength={255}
                    onClick={this.toggleEditing}
                    isEditing={this.state.isEditing} />
            </TableCell>
            <TableCell style={{ width: 16, padding: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {
                        this.state.isEditing ?
                            (
                                <React.Fragment>
                                    <IconButton onClick={this.save} title="Save Variable">
                                        <Check classes={{ root: `${this.canSave() ? "check" : "disabled"}` }} />
                                    </IconButton>
                                    <IconButton onClick={this.reset} title="Cancel Editing">
                                        <Cancel classes={{
                                            root: "cancel"
                                        }} />
                                    </IconButton>
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <IconButton className="edit-button" onClick={this.toggleEditing} title="Edit variable">
                                        <Edit />
                                    </IconButton>
                                    <IconButton className="delete-button" onClick={this.delete} title="Delete variable">
                                        <Delete />
                                    </IconButton>
                                </React.Fragment>
                            )

                    }
                </div>
            </TableCell>
        </TableRow>;
    }
}

class EditableLabelProps {
    label: string;
    isEditing: boolean;
    errorMessage?: string;
    autofocus?: boolean;
    maxlength?: number;
    onChange: (newValue: string) => void;
    onClick: () => void;
}

class EditableLabel extends React.Component<EditableLabelProps, {}> {

    constructor(props: EditableLabelProps) {
        super(props);

        this.state = {
            label: this.props.label
        };
    }

    protected readonly handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(e.target.value);
    };

    render() {
        if (this.props.isEditing) {
            const rootStyle = `${!this.props.errorMessage ? 'inherit' : 'error'}`;
            return <div>
                <div style={{ display: 'flex', alignItems: 'center' }}
                    className="editable-description">
                    <Input defaultValue={this.props.label} fullWidth={true} autoFocus={this.props.autofocus || false}
                        inputProps={!('maxlength' in this.props) ? undefined :
                            {
                                'maxlength': this.props.maxlength
                            }
                        }
                        className='description-input'
                        classes={{ root: rootStyle, focused: "focused" }}
                        onChange={this.handleChange}
                        style={{ flexGrow: 2 }}
                    >
                    </Input>
                </div>
                <div style={{ fontSize: 10, color: 'red' }}>
                    {this.props.errorMessage}
                </div>
            </div>;
        } else {
            return <div style={{ display: 'flex', alignItems: 'center' }} className="editable-description">
                <Typography
                    variant="body1"
                    component="p"
                    title={this.props.label}
                    style={{ flexGrow: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    onClick={this.props.onClick}>
                    {this.props.label}
                </Typography>
            </div>;
        }
    }
}

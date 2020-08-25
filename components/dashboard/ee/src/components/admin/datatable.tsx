/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as React from 'react';
import TablePagination from '@material-ui/core/TablePagination';
import Table from '@material-ui/core/Table';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import TableSortLabel from '@material-ui/core/TableSortLabel';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TextField from '@material-ui/core/TextField';

export interface ColSpec<Row> {
    header: string;
    property: keyof Row;
    sortable: boolean;
    render?: (u: Row) => JSX.Element;
}

export interface DataTableProps<Row> {
    update: (spec: SearchSpec<Row>) => Promise<{ total: number, rows: Row[] }>;
    columns: ColSpec<Row>[];
    searchable?: boolean;
    defaultOrderCol: keyof Row;
    defaultOrderDir?: "asc" | "desc";
}

export interface SearchSpec<Row> {
    page: number;
    rowsPerPage: number;
    orderCol: keyof Row;
    orderDir: "asc" | "desc";
    fields: { [key: string]: string };
    searchTerm?: string;
}

interface DataTableState<Row> {
    search: SearchSpec<Row>
    rows?: Row[]
    totalCount: number;
    errorBreaker: boolean;
}

export class DataTable<Row> extends React.Component<DataTableProps<Row>, DataTableState<Row>> {

    constructor(props: DataTableProps<Row>) {
        super(props);
        this.state = {
            search: {
                page: 0,
                orderCol: props.defaultOrderCol,
                orderDir: props.defaultOrderDir || "asc",
                rowsPerPage: 50,
                fields: {}
            },
            totalCount: 0,
            errorBreaker: true,
        }
    }

    componentDidMount() {
        this.update(this.state.search);
    }

    public render() {
        const columns = this.props.columns;
        return <React.Fragment>
            { this.props.searchable && <React.Fragment>
                    <TextField
                        placeholder="search"
                        style={{fontSize: '80%'}}
                        value={this.state.search.searchTerm || ''}
                        onChange={e => this.searchFor(e.target.value)} 
                        onKeyDown={e => { if (e.keyCode === 13) this.update(this.state.search); }}
                        />
                </React.Fragment> 
            }
            <Table>
                <TableHead>
                    <TableRow>{ columns.map((c, i) => (
                        <TableCell key={i}>
                            { c.sortable && <TableSortLabel
                                active={this.state.search.orderCol === c.property}
                                direction={this.state.search.orderDir}
                                onClick={() => this.sortColumn(c.property)}>
                                { c.header }
                            </TableSortLabel> }
                            { !c.sortable && c.header }
                        </TableCell>
                    ))}</TableRow>
                </TableHead>
                <TableBody>
                { (this.state.rows || [] ).map((u, i) => (
                    <TableRow key={i}> { columns.map((c, j) => (
                        <TableCell key={j}>
                            { !!c.render ? c.render(u) : u[c.property] }
                        </TableCell>
                    )) }
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            <TablePagination
                rowsPerPageOptions={[10, 50, 100]}
                component="div"
                count={this.state.totalCount}
                page={this.state.search.page}
                rowsPerPage={this.state.search.rowsPerPage}
                onChangePage={(_, page) => this.update({ page })}
                onChangeRowsPerPage={e => this.update({ rowsPerPage: parseInt(e.target.value) })}
            />
        </React.Fragment>
    }

    protected controlSearch(prop: keyof Row, enable: boolean) {
        const fields = this.state.search.fields;
        fields[prop as string] = "";
        const search = { ...this.state.search, fields };
        this.setState({search});
    }

    protected searchFor(value: string) {
        const search = { ...this.state.search, searchTerm: value };
        this.setState({search});
    }

    protected async update(q: Partial<SearchSpec<Row>>) {
        if (!this.state.errorBreaker) {
            return;
        }

        const search = {
            ...this.state.search,
            ...q,
        };

        try {
            this.setState({errorBreaker: false});
            const resp = await this.props.update(search);
            this.setState({ search, rows: resp.rows, totalCount: resp.total, errorBreaker: true });
        } catch (e) {
            this.setState(() => {
                throw e;
            });
        }
    }

    protected sortColumn(col: keyof Row) {
        const search = this.state.search;
        let orderDir = search.orderDir;
        if (search.orderCol === col) {
            orderDir = (orderDir === "asc" ? "desc" : "asc");
        }

        this.update({ orderCol: col, orderDir });
    }

}
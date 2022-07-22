// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package executor

import (
	"fmt"
	"strings"
)

type QueryBuilder interface {
	Parent() QueryBuilder
}

type queryExists struct {
	SrcDesc string
	Table   string
	Col     string
	Key     string
}

func (queryExists) Parent() QueryBuilder { return nil }

func StartChainWithExists(sourceDesc string, table string, col string, key string) QueryBuilder {
	return queryExists{SrcDesc: sourceDesc, Table: table, Col: col, Key: key}
}

type queryIdentity struct{ A, B string }

func (queryIdentity) Parent() QueryBuilder { return nil }

func StartChainWithIdentity(actorKey, subjectKey string) QueryBuilder {
	return queryIdentity{
		A: actorKey,
		B: subjectKey,
	}
}

type queryParentRel struct {
	Actor              QueryBuilder
	ActorKeyCol        string
	SubjectRelationCol string
	SubjectTable       string
}

func (q queryParentRel) Parent() QueryBuilder { return q.Actor }

func ChainParentRelation(actor QueryBuilder, actorKeyCol, subjectTable, subjectRelationCol string) QueryBuilder {
	return queryParentRel{
		Actor:              actor,
		ActorKeyCol:        actorKeyCol,
		SubjectTable:       subjectTable,
		SubjectRelationCol: subjectRelationCol,
	}
}

type ExprQueryBuilder struct {
	P            QueryBuilder
	SubjectTable string
	Terms        []QueryBuilder
	IsAnd        bool
}

func (q ExprQueryBuilder) Parent() QueryBuilder { return q.P }

func GroupChainOr(parent QueryBuilder, subjectTable string, terms ...QueryBuilder) QueryBuilder {
	return ExprQueryBuilder{
		P:            parent,
		SubjectTable: subjectTable,
		Terms:        terms,
		IsAnd:        false,
	}
}

func GroupChainAnd(parent QueryBuilder, subjectTable string, terms ...QueryBuilder) QueryBuilder {
	return ExprQueryBuilder{
		P:            parent,
		SubjectTable: subjectTable,
		Terms:        terms,
		IsAnd:        true,
	}
}

func Build(root QueryBuilder, res *query) (sql string, params []string, err error) {
	switch query := root.(type) {
	case queryExists:
		alias := res.TableAlias(query.Table)
		val := res.Param(query.Key)
		res.Where("%s.%s = %s", alias, query.Col, val)
	case queryIdentity:
		vala := res.Param(query.A)
		valb := res.Param(query.B)
		res.Where("%s = %s", vala, valb)
	case queryParentRel:
		child := NewQuery(res.NS, "")
		_, _, err := Build(query.Actor, child)
		if err != nil {
			return "", nil, err
		}

		for k, v := range child.Parameter {
			res.Parameter[k] = v
		}
		for k, v := range child.Tables {
			res.Tables[k] = v
		}

		res.WhereExpr = append(res.WhereExpr, fmt.Sprintf("(%s)", strings.Join(child.WhereExpr, " AND ")))

		subjTable := res.TableAlias(query.SubjectTable)
		res.Where("%s.%s = %s.%s", child.LastAlias(), query.ActorKeyCol, subjTable, query.SubjectRelationCol)
	case ExprQueryBuilder:
		res.TableAlias(query.SubjectTable)
		child := NewQuery(res.NS, "")
		for _, term := range query.Terms {
			_, _, err := Build(term, child)
			if err != nil {
				return "", nil, err
			}
		}

		for k, v := range child.Parameter {
			res.Parameter[k] = v
		}
		for k, v := range child.Tables {
			res.Tables[k] = v
		}

		op := " OR "
		if query.IsAnd {
			op = " AND "
		}
		res.WhereExpr = append(res.WhereExpr, fmt.Sprintf("(%s)", strings.Join(child.WhereExpr, op)))
	}

	return "", nil, nil
}

type Namespace struct {
	x int
}

func (ns *Namespace) Next() int {
	ns.x++
	return ns.x
}

func NewQuery(ns *Namespace, prefix string) *query {
	return &query{
		NS:        ns,
		Prefix:    prefix,
		Tables:    make(map[string]string),
		Parameter: make(map[string]string),
	}
}

type query struct {
	NS        *Namespace
	Prefix    string
	Tables    map[string]string
	Parameter map[string]string
	WhereExpr []string

	lastAlias string
}

func (q *query) SQL() (res string, params map[string]string) {
	var tables []string
	for k, v := range q.Tables {
		tables = append(tables, v+" "+k)
	}
	return fmt.Sprintf("SELECT COUNT(1) FROM %s WHERE %s", strings.Join(tables, ", "), strings.Join(q.WhereExpr, " AND ")), q.Parameter
}

func (q *query) NormalizeValues() {
	for k, v := range q.Parameter {
		for nk, nv := range q.Parameter {
			if nv != v || nk == k {
				continue
			}

			for i := range q.WhereExpr {
				q.WhereExpr[i] = strings.ReplaceAll(q.WhereExpr[i], nk, k)
			}
			delete(q.Parameter, nk)
		}
	}
	for k, v := range q.Tables {
		for nk, nv := range q.Tables {
			if nv != v || nk == k {
				continue
			}

			for i := range q.WhereExpr {
				q.WhereExpr[i] = strings.ReplaceAll(q.WhereExpr[i], nk, k)
			}
			delete(q.Tables, nk)
		}
	}
}

func (q *query) DangerousInsertValues() {
	for k, v := range q.Parameter {
		for i := range q.WhereExpr {
			q.WhereExpr[i] = strings.ReplaceAll(q.WhereExpr[i], k, `"`+v+`"`)
		}
	}
}

func (q *query) Add(other *query) {
	q.WhereExpr = append(q.WhereExpr, other.WhereExpr...)
	for k, v := range other.Parameter {
		q.Parameter[k] = v
	}
	for k, v := range other.Tables {
		q.Tables[k] = v
	}
}

func (q *query) Where(expr string, args ...interface{}) {
	q.WhereExpr = append(q.WhereExpr, fmt.Sprintf(expr, args...))
}

func (q *query) TableAlias(table string) string {
	alias := fmt.Sprintf("%st%03d", q.Prefix, q.NS.Next())
	if alias == "p001t003" {
		fmt.Println()
	}
	q.Tables[alias] = table
	q.lastAlias = alias
	return alias
}

func (q *query) Param(value string) (key string) {
	alias := fmt.Sprintf("%sv%03d", q.Prefix, q.NS.Next())
	q.Parameter[alias] = value
	return alias
}

func (q *query) LastAlias() string { return q.lastAlias }

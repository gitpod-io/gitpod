// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package executor

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/authorizer/pkg/dbgen"
)

func NewExecutor(types ...*dbgen.TypeSpec) (*Executor, error) {
	tpes := make(map[string]*executorTypeSpec, len(types))
	for _, t := range types {
		if _, exists := tpes[t.Name]; exists {
			return nil, fmt.Errorf("type %s is defined multuple times", t.Name)
		}

		var err error
		tpes[t.Name], err = newExecutorTypeSpec(t)
		if err != nil {
			return nil, err
		}
	}

	return &Executor{types: tpes}, nil
}

type Executor struct {
	types map[string]*executorTypeSpec
}

func (executor *Executor) Check(ctx context.Context, rel, actor, subject string) (allowed bool, err error) {
	actorTypeName, actorKey, err := SplitObj(actor)
	if err != nil {
		return false, err
	}
	subjectTypeName, subjectKey, err := SplitObj(subject)
	if err != nil {
		return false, err
	}

	actorType, exists := executor.types[actorTypeName]
	if !exists {
		return false, fmt.Errorf("actor type %s unknown", subjectTypeName)
	}
	subjectType, exists := executor.types[subjectTypeName]
	if !exists {
		return false, fmt.Errorf("subject type %s unknown", subjectTypeName)
	}
	subjectRel, exists := subjectType.Relations[rel]
	if !exists {
		return false, fmt.Errorf("relation %s does not exist on subject type %s", rel, subjectTypeName)
	}

	res, err := executor.buildRelation(subjectType.Spec, &subjectRel, actorKey, subjectKey)
	if err != nil {
		return false, err
	}

	o, _ := json.MarshalIndent(res, "", "  ")
	fmt.Println(string(o))

	queryBuild := GroupChainAnd(res, "",
		res,
		StartChainWithExists("checkActorExists", actorType.Spec.Table, actorType.Spec.IDColumn, actorKey),
		StartChainWithExists("checkSubjectExists", subjectType.Spec.Table, subjectType.Spec.IDColumn, subjectKey),
	)

	query, err := Build(queryBuild, nil)
	if err != nil {
		return false, err
	}
	query.NormalizeValues()

	fmt.Println(query.SQL())

	return false, nil
}

func (executor *Executor) buildRelation(tpe *dbgen.TypeSpec, rel *dbgen.Relation, actorKey, subjectKey string) (QueryBuilder, error) {
	var res []QueryBuilder
	for _, relTarget := range rel.Targets {
		switch rt := relTarget.(type) {
		case dbgen.RelationRef:
			targetTpe, exists := executor.types[tpe.Name]
			if !exists {
				return nil, fmt.Errorf("unknown type %s", tpe.Name)
			}
			targetRel, exists := targetTpe.Relations[string(rt)]
			if !exists {
				return nil, fmt.Errorf("unknown relation %s on type %s", tpe.Name, rt)
			}
			qs, err := executor.buildRelation(targetTpe.Spec, &targetRel, actorKey, subjectKey)
			if err != nil {
				return nil, err
			}
			res = append(res, qs)
		case dbgen.RelationRemoteRef:
			targetTpe, exists := executor.types[rt.Target.Name]
			if !exists {
				return nil, fmt.Errorf("unknown type %s", tpe.Name)
			}
			targetRel, exists := targetTpe.Relations[rt.Name]
			if !exists {
				return nil, fmt.Errorf("unknown relation %s on type %s", targetTpe.Spec.Name, rt.Name)
			}
			actor, err := executor.buildRelation(targetTpe.Spec, &targetRel, actorKey, subjectKey)
			if err != nil {
				return nil, err
			}

			idCol := rt.Target.IDColumn
			if rt.ActorRelColumn != "" {
				idCol = rt.ActorRelColumn
			}
			res = append(res, ChainParentRelation(actor, idCol, tpe.Table, rt.RelationColumn))
		case dbgen.RelationSelfContains:
			res = append(res, GroupChainAnd(nil, tpe.Table,
				StartChainWithExists(fmt.Sprintf("%s is self", tpe.Name), tpe.Table, tpe.IDColumn, actorKey),
				StartChainWithExists(fmt.Sprintf("%s contains", tpe.Name), tpe.Table, rt.Column, rt.Substring),
			))

		case dbgen.RelationSelf:
			res = append(res, StartChainWithExists(fmt.Sprintf("%s is self", tpe.Name), tpe.Table, tpe.IDColumn, actorKey))
		}
	}

	var finalStatement QueryBuilder
	switch len(res) {
	case 0:
		return nil, fmt.Errorf("did not generate statements for %s.%s - does the relation have any targets?", tpe.Name, rel.Name)
	case 1:
		finalStatement = res[0]
	default:
		finalStatement = GroupChainOr(nil, tpe.Table, res...)
	}

	return finalStatement, nil
}

type executorTypeSpec struct {
	Spec      *dbgen.TypeSpec
	Relations map[string]dbgen.Relation
}

func newExecutorTypeSpec(spec *dbgen.TypeSpec) (*executorTypeSpec, error) {
	rels := make(map[string]dbgen.Relation, len(spec.Relations))
	for _, rel := range spec.Relations {
		if _, exists := rels[rel.Name]; exists {
			return nil, fmt.Errorf("relation %s exists multiple times in %s", rel.Name, spec.Name)
		}
		rels[rel.Name] = rel
	}
	return &executorTypeSpec{
		Spec:      spec,
		Relations: rels,
	}, nil
}

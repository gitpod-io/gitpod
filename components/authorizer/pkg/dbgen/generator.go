// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbgen

import (
	"fmt"
	"strings"
	"sync"

	"github.com/dave/jennifer/jen"
)

type Session struct {
	f      *jen.File
	checks [][]string
	types  []*TypeSpec

	once sync.Once
}

func (s *Session) String() string {
	return s.f.GoString()
}

func (s *Session) Commit() {
	s.once.Do(func() {
		vals := make(jen.Dict)
		for _, tpe := range s.types {
			vals[jen.Lit(tpe.Name)] = jen.Values(jen.Dict{
				jen.Id("Table"):    jen.Lit(tpe.Table),
				jen.Id("IDColumn"): jen.Lit(tpe.IDColumn),
			})
		}
		s.f.Var().Id("types").Op("=").Map(jen.String()).Qual(pkgDbgen, "TypeSpec").Values(vals)

		s.f.Line()
		s.f.Func().Params(jen.Id("sess").Id("*Session")).Id("Check").Params(jen.Id("actor"), jen.Id("rel"), jen.Id("subject").String()).Params(jen.Qual(pkgExecutor, "QueryBuilder"), jen.Id("error")).BlockFunc(func(g *jen.Group) {
			g.List(jen.Id("actorType"), jen.Id("actorKey"), jen.Id("err")).Op(":=").Qual("github.com/gitpod-io/gitpod/authorizer/pkg/executor", "SplitObj").Params(jen.Id("actor"))
			g.If(jen.Id("err").Op("!=").Nil()).Block(jen.Return(jen.Nil(), jen.Id("err")))
			g.List(jen.Id("subjectType"), jen.Id("subjectKey"), jen.Id("err")).Op(":=").Qual("github.com/gitpod-io/gitpod/authorizer/pkg/executor", "SplitObj").Params(jen.Id("subject"))
			g.If(jen.Id("err").Op("!=").Nil()).Block(jen.Return(jen.Nil(), jen.Id("err")))

			g.Line()
			g.Var().Id("res").Qual(pkgExecutor, "QueryBuilder")
			g.Switch().BlockFunc(func(g *jen.Group) {
				for _, check := range s.checks {
					spec, rel := check[0], check[1]
					g.Case(jen.Id("subjectType").Op("==").Lit(spec).Op("&&").Id("rel").Op("==").Lit(rel)).BlockFunc(func(g *jen.Group) {
						g.Id("res").Op("=").Id("sess."+checkFuncName(spec, rel)).Call(jen.Id("actorKey"), jen.Id("subjectKey"))
					})
				}
				g.Default().Block(jen.Return(jen.Nil(), jen.Qual("fmt", "Errorf").Call(jen.Lit("unknown relation \"%s\" is \"%s\" on \"%s\""), jen.Id("actorType"), jen.Id("rel"), jen.Id("subjectType"))))
			})

			g.Line()
			g.Id("actorTpe").Op(":=").Id("types").Index(jen.Id("actorType"))
			g.Id("subjectTpe").Op(":=").Id("types").Index(jen.Id("subjectType"))
			g.Return(
				jen.Qual(pkgExecutor, "GroupChainAnd").Call(
					jen.Id("res"),
					jen.Lit(""),
					jen.Id("res"),
					jen.Qual(pkgExecutor, "StartChainWithExists").Call(jen.Lit("checkActorExists"), jen.Id("actorTpe").Dot("Table"), jen.Id("actorTpe").Dot("IDColumn"), jen.Id("actorKey")),
					jen.Qual(pkgExecutor, "StartChainWithExists").Call(jen.Lit("checkSubjectExists"), jen.Id("subjectTpe").Dot("Table"), jen.Id("subjectTpe").Dot("IDColumn"), jen.Id("subjectKey")),
				),
				jen.Nil(),
			)
		})

		s.f.Type().Id("Session").Struct(
			jen.Id("DB").Qual("github.com/gitpod-io/gitpod/authorizer/pkg/executor", "DB"),
		)
	})
}

func NewSession(pkg string) *Session {
	return &Session{f: jen.NewFile(pkg)}
}

const (
	pkgExecutor = "github.com/gitpod-io/gitpod/authorizer/pkg/executor"
	pkgDbgen    = "github.com/gitpod-io/gitpod/authorizer/pkg/dbgen"
)

func (s *Session) Generate(spec *TypeSpec) error {
	s.types = append(s.types, spec)
	for _, rel := range spec.Relations {
		s.checks = append(s.checks, []string{spec.Name, rel.Name})

		var res []jen.Code
		for _, relTarget := range rel.Targets {
			switch rt := relTarget.(type) {
			case RelationRef:
				res = append(res, jen.Id("sess."+checkFuncName(spec.Name, string(rt))).Call(jen.Id("actorKey"), jen.Id("subjectKey")))
			case RelationRemoteRef:
				res = append(res, jen.Qual(pkgExecutor, "ChainParentRelation").Call(
					jen.Id("sess."+checkFuncName(rt.Target.Name, rt.Name)).Call(jen.Id("actorKey"), jen.Id("subjectKey")),
					jen.Lit(rt.Target.IDColumn),
					jen.Lit(spec.Table),
					jen.Lit(rt.RelationColumn),
				))
			case RelationTable:
				return fmt.Errorf("RelationTable unsupported")

			case RelationSelf:
				res = append(res, jen.Qual(pkgExecutor, "StartChainWithExists").Call(jen.Lit(fmt.Sprintf("%s is self", spec.Name)), jen.Lit(spec.Table), jen.Lit(spec.IDColumn), jen.Id("actorKey")))
			}
		}

		var finalStatement jen.Code
		switch len(res) {
		case 0:
			return fmt.Errorf("did not generate statements for %s.%s - does the relation have any targets?", spec.Name, rel.Name)
		case 1:
			finalStatement = res[0]
		default:
			finalStatement = jen.Qual(pkgExecutor, "GroupChainOr").Call(append([]jen.Code{jen.Nil(), jen.Lit(spec.Table)}, res...)...)
		}

		s.f.Func().Params(jen.Id("sess").Id("*Session")).Id(checkFuncName(spec.Name, rel.Name)).
			Params(jen.Id("actorKey"), jen.Id("subjectKey").String()).
			Params(jen.Qual(pkgExecutor, "QueryBuilder")).
			Block(jen.Return(finalStatement))
	}

	return nil
}

func checkFuncName(specName, relName string) string {
	return fmt.Sprintf("check%s%s", camelcase(specName), camelcase(relName))
}

func camelcase(s string) string {
	segs := strings.Split(s, "_")
	for i := range segs {
		segs[i] = strings.Title(segs[i])
	}
	return strings.Join(segs, "")
}

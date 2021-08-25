// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package lang

import (
	"context"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"text/scanner"
	"unicode"

	"github.com/PaesslerAG/gval"
)

var Lang = gval.NewLanguage(
	// Logic
	gval.InfixShortCircuit("&&", func(lhs interface{}) (interface{}, bool) { return false, lhs == false }),
	gval.InfixShortCircuit("||", func(lhs interface{}) (interface{}, bool) { return true, lhs == true }),

	gval.InfixBoolOperator("&&", func(lhs, rhs bool) (interface{}, error) { return lhs && rhs, nil }),
	gval.InfixBoolOperator("||", func(lhs, rhs bool) (interface{}, error) { return lhs || rhs, nil }),

	gval.InfixBoolOperator("==", func(lhs, rhs bool) (interface{}, error) { return lhs == rhs, nil }),
	gval.InfixBoolOperator("!=", func(lhs, rhs bool) (interface{}, error) { return lhs != rhs, nil }),

	// Arithmetic

	gval.InfixNumberOperator("==", func(lhs, rhs float64) (interface{}, error) { return lhs == rhs, nil }),
	gval.InfixNumberOperator("!=", func(lhs, rhs float64) (interface{}, error) { return lhs != rhs, nil }),

	gval.InfixNumberOperator("<", func(lhs, rhs float64) (interface{}, error) { return lhs < rhs, nil }),
	gval.InfixNumberOperator("<=", func(lhs, rhs float64) (interface{}, error) { return lhs <= rhs, nil }),
	gval.InfixNumberOperator(">", func(lhs, rhs float64) (interface{}, error) { return lhs > rhs, nil }),
	gval.InfixNumberOperator(">=", func(lhs, rhs float64) (interface{}, error) { return lhs >= rhs, nil }),

	// Text

	gval.InfixEvalOperator("~~", regEx),

	// Base

	gval.InfixOperator("==", func(lhs, rhs interface{}) (interface{}, error) { return reflect.DeepEqual(lhs, rhs), nil }),
	gval.InfixOperator("!=", func(lhs, rhs interface{}) (interface{}, error) { return !reflect.DeepEqual(lhs, rhs), nil }),

	gval.PrefixExtension(scanner.Int, parseNumber),
	gval.PrefixExtension(scanner.Float, parseNumber),
	gval.PrefixExtension(scanner.RawString, parseString),

	gval.Constant("true", true),
	gval.Constant("false", false),

	gval.Parentheses(),

	gval.Precedence("||", 20),
	gval.Precedence("&&", 21),

	gval.Precedence("==", 40),
	gval.Precedence("!=", 40),
	gval.Precedence("~~", 40),

	gval.Precedence("<", 40),
	gval.Precedence("<=", 40),
	gval.Precedence(">", 40),
	gval.Precedence(">=", 40),

	gval.PrefixMetaPrefix(scanner.Ident, parseIdent),
)

var Fields []string

func Compile(expression string) (gval.Evaluable, error) {
	return Lang.NewEvaluable(expression)
}

func Execute(eval gval.Evaluable, data map[string]interface{}) (interface{}, error) {
	return eval(context.Background(), data)
}

func parseString(c context.Context, p *gval.Parser) (gval.Evaluable, error) {
	s, err := strconv.Unquote(p.TokenText())
	if err != nil {
		return nil, fmt.Errorf("could not parse string: %s", err)
	}
	return p.Const(s), nil
}

func parseNumber(c context.Context, p *gval.Parser) (gval.Evaluable, error) {
	n, err := strconv.ParseFloat(p.TokenText(), 64)
	if err != nil {
		return nil, err
	}
	return p.Const(n), nil
}

func regEx(a, b gval.Evaluable) (gval.Evaluable, error) {
	if !b.IsConst() {
		return func(c context.Context, o interface{}) (interface{}, error) {
			a, err := a.EvalString(c, o)
			if err != nil {
				return nil, err
			}
			b, err := b.EvalString(c, o)
			if err != nil {
				return nil, err
			}
			matched, err := regexp.MatchString(b, a)
			return matched, err
		}, nil
	}
	s, err := b.EvalString(context.TODO(), nil)
	if err != nil {
		return nil, err
	}
	regex, err := regexp.Compile(s)
	if err != nil {
		return nil, err
	}
	return func(c context.Context, v interface{}) (interface{}, error) {
		s, err := a.EvalString(c, v)
		if err != nil {
			return nil, err
		}
		return regex.MatchString(s), nil
	}, nil
}

func parseIdent(c context.Context, p *gval.Parser) (call string, alternative func() (gval.Evaluable, error), err error) {
	token := p.TokenText()
	return token, func() (gval.Evaluable, error) {
		tok := token
		for {
			scan := p.Scan()
			curr := p.TokenText()
			switch scan {
			case '-':
				fallthrough
			case '>':
				// Disambiguate greater than (>) operator to obtain correct parsing
				r := p.Peek()
				if unicode.IsLetter(r) || r == '_' || r == '-' || r == '[' || unicode.IsDigit(r) {
					scan = p.Scan()
				} else {
					p.Camouflage("variable")
					Fields = append(Fields, tok)
					return p.Var(p.Const(tok)), nil
				}
				// Continue scanning the identifier
				switch scan {
				case scanner.Int:
					fallthrough
				case scanner.Ident:
					fallthrough
				case '[':
					tok += curr + p.TokenText()
					continue
				default:
					return nil, p.Expected("field", scanner.Ident)
				}
			case scanner.Int:
				tok += p.TokenText()

				switch p.Scan() {
				case ']':
					tok += "]"
				default:
					return nil, p.Expected("array closing bracket", ']')
				}
			default:
				p.Camouflage("variable", '>', '-')
				Fields = append(Fields, tok)
				return p.Var(p.Const(tok)), nil
			}
		}
	}, nil
}

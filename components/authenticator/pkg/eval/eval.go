package eval

import (
	"context"
	"fmt"

	"github.com/gitpod-io/gitpod/authenticator/pkg/policy"
	"github.com/gitpod-io/gitpod/authenticator/pkg/resourcegraph"
)

var (
	ErrUnknownResource = fmt.Errorf("unknown resource")
)

type Evaluator struct {
	Policies policy.StoreReader
	Graph    resourcegraph.StoreReader
}

func (eval *Evaluator) IsAllowed(ctx context.Context, subject policy.ResourceName, action policy.Action, on policy.ResourceSegment) (bool, error) {
	applicablePolicies, err := eval.Policies.Get(subject)
	if err != nil {
		return false, fmt.Errorf("cannot get policies: %w", err)
	}

	names, err := eval.Graph.GetNames(on)
	if err != nil {
		return false, err
	}
	if len(names) == 0 {
		return false, fmt.Errorf("%w: %s", ErrUnknownResource, on.String())
	}

	var (
		isAllowed bool
		isDenied  bool
	)
	for _, pl := range applicablePolicies {
		for _, nme := range names {
			applies, err := pl.WithSubject(subject).Applies(nme, action)
			if err != nil {
				return false, err
			}
			if !applies {
				continue
			}

			if pl.Effect == policy.EffectDeny {
				// TODO(cw): we could optimise this and return early. For this demo I want to make the code clearer though.
				isDenied = true
			}
			if pl.Effect == policy.EffectAllow {
				isAllowed = true
			}
		}
	}
	return isAllowed && !isDenied, nil
}

package main

import (
	context "context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/authenticator/api/authenticator/v1"
	"github.com/gitpod-io/gitpod/authenticator/api/authenticator/v1/v1connect"
	"github.com/gitpod-io/gitpod/authenticator/pkg/eval"
	"github.com/gitpod-io/gitpod/authenticator/pkg/policy"
	"github.com/gitpod-io/gitpod/authenticator/pkg/resourcegraph"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	gstore := resourcegraph.NewMemoryStore()
	pstore := policy.NewMemoryStore()

	mux := http.NewServeMux()
	// The generated constructors return a path and a plain net/http
	// handler.
	mux.Handle(v1connect.NewGraphServiceHandler(&graphService{Store: gstore}))
	mux.Handle(v1connect.NewPolicyServiceHandler(&policyService{
		Resources: gstore,
		Policies:  pstore,
		Eval: &eval.Evaluator{
			Policies: pstore,
			Graph:    gstore,
		},
	}))
	mux.Handle(v1connect.NewEvalServiceHandler(&evalServiceHandler{}))

	webuiURL, _ := url.Parse("http://localhost:3000")
	mux.Handle("/", httputil.NewSingleHostReverseProxy(webuiURL))
	fmt.Println("listening on :8080")

	err := http.ListenAndServe(
		":8080",
		// For gRPC clients, it's convenient to support HTTP/2 without TLS. You can
		// avoid x/net/http2 by using http.ListenAndServeTLS.
		h2c.NewHandler(newCORS().Handler(mux), &http2.Server{}),
	)
	log.Fatalf("listen failed: %v", err)
}

func newCORS() *cors.Cors {
	// To let web developers play with the demo service from browsers, we need a
	// very permissive CORS setup.
	return cors.New(cors.Options{
		AllowedMethods: []string{
			http.MethodHead,
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
		},
		AllowOriginFunc: func(origin string) bool {
			// Allow all origins, which effectively disables CORS.
			return true
		},
		AllowedHeaders: []string{"*"},
		ExposedHeaders: []string{
			// Content-Type is in the default safelist.
			"Accept",
			"Accept-Encoding",
			"Accept-Post",
			"Connect-Accept-Encoding",
			"Connect-Content-Encoding",
			"Content-Encoding",
			"Grpc-Accept-Encoding",
			"Grpc-Encoding",
			"Grpc-Message",
			"Grpc-Status",
			"Grpc-Status-Details-Bin",
		},
		// Let browsers cache CORS information for longer, which reduces the number
		// of preflight requests. Any changes to ExposedHeaders won't take effect
		// until the cached data expires. FF caps this value at 24h, and modern
		// Chrome caps it at 2h.
		MaxAge: int(2 * time.Hour / time.Second),
	})
}

type graphService struct {
	Store resourcegraph.StoreWriter
}

// AddEdge implements v1connect.GraphServiceHandler
func (s *graphService) AddEdge(ctx context.Context, req *connect.Request[v1.AddEdgeRequest]) (*connect.Response[v1.AddEdgeResponse], error) {
	rn := policy.ResourceName(req.Msg.ResourceFqdn)
	if !rn.Valid() {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("resource FQDN %v is not a valid resource name", req.Msg.ResourceFqdn))
	}
	if !rn.IsDefinite() {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("resource FQDN %v must not contain wildcards", req.Msg.ResourceFqdn))
	}

	err := s.Store.Add(rn)
	if err != nil {
		return nil, connect.NewError(connect.CodeFailedPrecondition, err)
	}

	fmt.Println("\nedge added")
	s.Store.Dump(os.Stdout)

	return connect.NewResponse(&v1.AddEdgeResponse{}), nil
}

type policyService struct {
	Resources resourcegraph.StoreReader
	Policies  policy.Store
	Eval      *eval.Evaluator
}

// AddPolicy implements v1connect.PolicyServiceHandler
func (s *policyService) AddPolicy(ctx context.Context, req *connect.Request[v1.AddPolicyRequest]) (*connect.Response[v1.AddPolicyResponse], error) {
	policies := make([]policy.Policy, 0, len(req.Msg.Policy))
	for _, p := range req.Msg.Policy {
		res := make([]policy.ResourceName, len(p.Resources))
		for i, pres := range p.Resources {
			rn := policy.ResourceName(pres)
			if !rn.Valid() {
				return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("%s is not a valid resource name", pres))
			}
			res[i] = rn
		}

		actions := make([]policy.Action, len(p.Actions))
		for i := range actions {
			actions[i] = policy.Action(p.Actions[i])
		}

		var effect policy.Effect
		switch p.Effect {
		case v1.Effect_EFFECT_ALLOW:
			effect = policy.EffectAllow
		case v1.Effect_EFFECT_DENY:
			effect = policy.EffectDeny
		default:
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("%v is not a valid effect", p.Effect))
		}

		policies = append(policies, policy.Policy{
			Resources: res,
			Actions:   actions,
			Effect:    effect,
		})
	}

	err := s.Policies.Add(policy.ResourceName(req.Msg.Subject), policies)
	if err != nil {
		return nil, connect.NewError(connect.CodeFailedPrecondition, err)
	}

	return connect.NewResponse(&v1.AddPolicyResponse{}), nil
}

// IsAllowed implements v1connect.PolicyServiceHandler
func (s *policyService) IsAllowed(ctx context.Context, req *connect.Request[v1.IsAllowedRequest]) (*connect.Response[v1.IsAllowedResponse], error) {
	seg, err := policy.ParseResourceSegment(req.Msg.Resource)
	if errors.Is(err, policy.ErrInvalidResourceName) {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	} else if err != nil {
		return nil, connect.NewError(connect.CodeFailedPrecondition, err)
	}

	allowed, err := s.Eval.IsAllowed(ctx, policy.ResourceName(req.Msg.Subject), policy.Action(req.Msg.Action), *seg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	return connect.NewResponse(&v1.IsAllowedResponse{
		Allowed: allowed,
	}), nil
}

type evalServiceHandler struct{}

// CleanSlateEval implements v1connect.EvalServiceHandler
func (*evalServiceHandler) CleanSlateEval(ctx context.Context, req *connect.Request[v1.CleanSlateEvalRequest]) (*connect.Response[v1.CleanSlateEvalResponse], error) {
	policies := policy.NewMemoryStore()
	for _, p := range req.Msg.Policies {
		resources := make([]policy.ResourceName, len(p.Resources))
		for i, r := range p.Resources {
			resources[i] = policy.ResourceName(r)
		}
		actions := make([]policy.Action, len(p.Actions))
		for i, v := range p.Actions {
			actions[i] = policy.Action(v)
		}
		var effect policy.Effect
		switch p.Effect {
		case v1.Effect_EFFECT_ALLOW:
			effect = policy.EffectAllow
		case v1.Effect_EFFECT_DENY:
			effect = policy.EffectDeny
		default:
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("unknown effect: %v", p.Effect))
		}

		err := policies.Add(policy.ResourceName(p.Subject), []policy.Policy{
			{
				Resources: resources,
				Actions:   actions,
				Effect:    effect,
			},
		})
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("cannot add policy: %w", err))
		}
	}

	resources := resourcegraph.NewMemoryStore()
	for _, r := range req.Msg.Resources {
		err := resources.Add(policy.ResourceName(r))
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("cannot add resource %s: %w", r, err))
		}
	}

	evaluator := &eval.Evaluator{
		Policies: policies,
		Graph:    resources,
	}

	var res []*v1.CleanSlateEvalResponse_EvalResult
	for i, q := range req.Msg.Queries {
		desc := fmt.Sprintf("%03d: can %s do %s on %s is %v", i, q.Subject, q.Action, q.Resource, q.Expectation)

		seq, err := policy.ParseResourceSegment(q.Resource)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid resource segment %s: %w", desc, err))
		}
		allowed, err := evaluator.IsAllowed(ctx, policy.ResourceName(q.Subject), policy.Action(q.Action), *seq)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("cannot eval %s: %w", desc, err))
		}

		res = append(res, &v1.CleanSlateEvalResponse_EvalResult{
			Description: desc,
			Correct:     allowed == q.Expectation,
		})
	}
	return connect.NewResponse(&v1.CleanSlateEvalResponse{Results: res}), nil
}

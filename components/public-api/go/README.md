# Golang bindings for Gitpod API
This package contains API definitions and client bindings for interacting with Gitpod API.

## Usage
```bash
go get -u github.com/gitpod-io/gitpod/components/public-api/go
```

```golang

import (
    "github.com/bufbuild/connect-go"

    gitpod_experimental_v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
    gitpod_experimental_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
)

// Define an interceptor to attach credentials onto outgoing requests
interceptor := connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
    return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
      if req.Spec().IsClient {
        // Send a token with client requests.
        req.Header().Set("Authorization", "Bearer your-access-token")
      }

      return next(ctx, req)
    })
  })

// Construct a new client to interact with Gitpod
client := gitpod_experimental_v1connect.NewTeamsServiceClient(http.DefaultClient, "https://api.gitpod.io", connect.WithInterceptors(
    inteceptor,
))

// Use the client to retreive teams
response, err := client.ListTeams(context.Background(), gitpod_experimental_v1connect.NewRequest(&gitpod_experimental_v1.ListTeamsRequest{}))
```

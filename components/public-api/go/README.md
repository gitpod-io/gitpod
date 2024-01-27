# Golang bindings for Gitpod API
This package contains API definitions and client bindings for interacting with Gitpod API.

## Usage
```bash
go get -u github.com/gitpod-io/gitpod/components/public-api/go
```

```golang
import (
    "context"
    "fmt"
    "os"
    "time"

    "github.com/bufbuild/connect-go"
    "github.com/gitpod-io/gitpod/components/public-api/go/client"
    v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

func ExampleListTeams() {
    token := "gitpod_pat_example.personal-access-token"

    gitpod, err := client.New(client.WithCredentials(token))
    if err != nil {
        fmt.Fprintf(os.Stderr, "Failed to construct gitpod client %v", err)
        return
    }

    response, err := gitpod.Teams.ListTeams(context.Background(), connect.NewRequest(&v1.ListTeamsRequest{}))
    if err != nil {
        fmt.Fprintf(os.Stderr, "Failed to list teams %v", err)
        return
    }

    fmt.Fprintf(os.Stdout, "Retrieved teams %v", response.Msg.GetTeams())
}
```

For more examples, see [examples](./examples) directory.

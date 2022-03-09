# Public-API

# Open Questions

## Error Handling

### Rich Errors?

### Errors as part of the protocol

## Pagination

# Example Flows
This section gives examples how clients would use this API.

## Create Workspace

### Not prebuild aware
```go
workspaces.CreateWorkspace({
    idempotency_token: "<random_string>",
    context_url: "https://github.com/gitpod-io/gitpod",
})
```

### Prebuild aware but no log support
```go
workspaces.CreateWorkspace({
    idempotency_token: "<random_string>",
    context_url: "https://github.com/gitpod-io/gitpod",
    prebuild: {
        if_available: true,
    }
})
```

### Prebuild aware with log support
```go
contextURL := "https://github.com/gitpod-io/gitpod"
prb := prebuilds.GetRunningPrebuild({ context_url: contextURL })
logs := prebuilds.ListenToPrebuild({ context_url: contextURL, prebuild_id: prb.PrebuildID })

for logs.Recv() {
    // display logs
}
// once logs are done, prebuild is done (errors notwithstanding)

workspaces.CreateWorkspace({
    idempotency_token: "<random_string>",
    context_url: contextURL,
    prebuild: {
        prebuild_id: prb.PrebuildID,
    }
})
```

## Start Workspace

### Ignoring image-build logs
```Go
// Get ahold of a workspace ID, either by finding an existing workspace
// or creating a new one.
workspaceID := ...

// Start the workspace
workspaces.StartWorkspace({
    idempotency_token: "<random_string>",
    workspace_id: workspaceID,
})
```

### With image build log support
```Go
// Get ahold of a workspace ID, either by finding an existing workspace
// or creating a new one.
workspaceID := ...

// Start the workspace
resp := workspaces.StartWorkspace({
    idempotency_token: "<random_string>",
    workspace_id: workspaceID,
})

// Listen to updates for the instance we just created
updates := workspaces.ListenToWorkspaceInstance({
    instance_id: resp.InstanceId
})
var lastSeenVersion uint64
for {
    update := updates.Recv()
    if lastSeenVersion == update.Version {
        continue
    }
    lastSeenVersion = update.Version

    switch update.Phase {
        case ImageBuild:
            go showImageBuildLogs(instanceID)
        case Running:
            // do something with this running workspace
    }
}

func showImageBuildLogs(instanceID string) {
    logs := workspaces.ListenToImageBuildLogs({instance_id: instanceID})
    for {
        resp := logs.Recv()
        fmt.Println(resp.Line)
    }
}
```
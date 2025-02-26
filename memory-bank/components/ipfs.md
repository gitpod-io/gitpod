# IPFS Component

## Overview

The IPFS (InterPlanetary File System) component in Gitpod consists of two main parts: Kubo and IPFS Cluster. Kubo is the core IPFS implementation in Go, while IPFS Cluster provides pinset orchestration for IPFS. This component is primarily used by the registry-facade component to cache container image layers, improving performance and reliability of workspace image distribution.

## Purpose

The primary purposes of the IPFS component are:
- Cache container image layers for faster workspace startup
- Provide a distributed content-addressable storage system
- Reduce bandwidth usage by deduplicating container image layers
- Improve reliability of image distribution
- Enable efficient sharing of container images across nodes
- Support the registry-facade component with blob storage
- Provide content-based addressing for immutable data
- Enhance performance of workspace image pulls
- Reduce load on external container registries

## Architecture

The IPFS component consists of two main parts:

1. **Kubo**: The core IPFS implementation in Go
   - Provides the IPFS node functionality
   - Handles content-addressable storage
   - Manages the IPFS peer-to-peer network
   - Exposes an HTTP API for interacting with IPFS

2. **IPFS Cluster**: A pinset orchestration layer for IPFS
   - Coordinates multiple IPFS nodes
   - Manages pinning of content across nodes
   - Ensures data replication and availability
   - Provides an API for cluster management

Both components are packaged as Docker images that wrap the official IPFS images with additional tools like `jq` and, in the case of IPFS Cluster, `kubectl` for Kubernetes integration.

## Key Features

### Kubo (IPFS Node)

- **Content-Addressable Storage**: Stores data based on its content hash
- **Deduplication**: Automatically deduplicates identical content
- **P2P Network**: Participates in the IPFS peer-to-peer network
- **HTTP API**: Provides an API for interacting with the IPFS node
- **Content Retrieval**: Enables retrieval of content by its CID (Content Identifier)
- **Content Storage**: Allows adding content to the IPFS network

### IPFS Cluster

- **Pinset Management**: Coordinates pinning of content across IPFS nodes
- **Replication**: Ensures content is replicated across multiple nodes
- **Health Monitoring**: Monitors the health of IPFS nodes
- **Kubernetes Integration**: Includes kubectl for Kubernetes integration
- **Cluster API**: Provides an API for managing the IPFS cluster

## Integration Points

The IPFS component integrates with:
1. **Registry-Facade**: Uses IPFS for caching container image layers
2. **Redis**: Used alongside IPFS for mapping digests to CIDs
3. **Container Registries**: Caches content from external registries
4. **Kubernetes**: IPFS Cluster includes kubectl for Kubernetes integration

## Usage Patterns

### Container Image Caching

The primary use of IPFS in Gitpod is for caching container image layers:

1. When a container image is pulled, registry-facade checks if the layers are already in IPFS
2. If a layer is not in IPFS, it is fetched from the original source and stored in IPFS
3. The digest of the layer is mapped to its IPFS CID in Redis
4. For subsequent pulls, layers are retrieved from IPFS instead of the original source
5. This improves performance and reduces bandwidth usage

### IPFS API Usage

The registry-facade component interacts with IPFS through its HTTP API:

```go
// Store a blob in IPFS
func (store *IPFSBlobCache) Store(ctx context.Context, dgst digest.Digest, r io.ReadCloser, mediaType string) error {
    // Create a file from the reader
    file := files.NewReaderFile(r)

    // Add the file to IPFS
    path, err := store.IPFS.Unixfs().Add(ctx, file)
    if err != nil {
        return err
    }

    // Store the mapping from digest to CID in Redis
    err = store.Redis.Set(ctx, dgst.String(), path.Cid().String(), 0).Err()
    if err != nil {
        return err
    }

    return nil
}

// Get a blob from IPFS
func (store *IPFSBlobCache) Get(ctx context.Context, dgst digest.Digest) (ipfsURL string, err error) {
    // Get the CID from Redis
    ipfsCID, err := store.Redis.Get(ctx, dgst.String()).Result()
    if err != nil {
        return "", err
    }

    return "ipfs://" + ipfsCID, nil
}
```

## Configuration

The IPFS component is configured through environment variables and configuration files:

### Kubo Configuration
- Version is specified by the `ipfsKuboVersion` variable
- Additional configuration is typically provided through IPFS config files

### IPFS Cluster Configuration
- Version is specified by the `ipfsClusterVersion` variable
- Cluster configuration is typically provided through IPFS Cluster config files

### Registry-Facade Integration
The registry-facade component is configured to use IPFS through its configuration:

```json
{
  "ipfs": {
    "enabled": true,
    "ipfsAddr": "/ip4/127.0.0.1/tcp/5001"
  }
}
```

## Dependencies

### Internal Dependencies
None explicitly specified in the available code.

### External Dependencies
- `docker.io/ipfs/kubo`: The official Kubo Docker image
- `docker.io/ipfs/ipfs-cluster`: The official IPFS Cluster Docker image
- `github.com/ipfs/boxo`: IPFS libraries
- `github.com/ipfs/kubo`: Kubo IPFS implementation
- `github.com/ipfs/go-cid`: Content identifier library
- `github.com/multiformats/go-multiaddr`: Multiaddress library

## Security Considerations

When using IPFS, several security considerations should be kept in mind:

1. **Content Verification**: Verify content integrity using cryptographic hashes
2. **Network Exposure**: Limit network exposure of IPFS nodes
3. **Resource Limits**: Set appropriate resource limits to prevent DoS
4. **Access Control**: Implement access controls for the IPFS API
5. **Data Privacy**: Be aware that content on IPFS is public by default

## Implementation Details

### Kubo Docker Image

The Kubo Docker image is built from the official IPFS Kubo image with the addition of the `jq` tool:

```dockerfile
FROM docker.io/ipfs/kubo:${VERSION}

COPY --from=dependencies /jq /usr/bin/jq
```

### IPFS Cluster Docker Image

The IPFS Cluster Docker image is built from the official IPFS Cluster image with the addition of `jq` and `kubectl`:

```dockerfile
FROM docker.io/ipfs/ipfs-cluster:${VERSION}

COPY --from=dependencies /jq /usr/bin/jq
COPY --from=dependencies /kubectl /usr/bin/kubectl
```

### Registry-Facade Integration

The registry-facade component integrates with IPFS through the `IPFSBlobCache` struct, which provides methods for storing and retrieving blobs from IPFS. It uses Redis to map content digests to IPFS CIDs.

## Related Components

- **Registry-Facade**: Uses IPFS for caching container image layers
- **Redis**: Used alongside IPFS for mapping digests to CIDs
- **Content-Service**: May interact with IPFS for content storage
- **Workspace**: Benefits from faster image pulls due to IPFS caching

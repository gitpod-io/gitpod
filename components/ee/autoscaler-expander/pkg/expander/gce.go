package expander

import (
	"context"
	"fmt"
	"os"
	"strings"

	"cloud.google.com/go/compute/metadata"
	"golang.org/x/oauth2/google"
	gce "google.golang.org/api/compute/v1"
	option "google.golang.org/api/option"
	provider_gce "k8s.io/legacy-cloud-providers/gce"
)

func newGceClient() (*gce.Service, error) {
	ctx := context.Background()

	var err error
	tokenSource := google.ComputeTokenSource("")
	if len(os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")) > 0 {
		tokenSource, err = google.DefaultTokenSource(context.Background(), gce.ComputeScope)
		if err != nil {
			return nil, err
		}
	}

	gceService, err := gce.NewService(ctx,
		option.WithTokenSource(tokenSource),
		option.WithUserAgent("gitpod-autoscaler-expander"),
	)
	if err != nil {
		return nil, err
	}

	return gceService, nil
}

func getProjectAndLocation(regional bool) (string, string, error) {
	result, err := metadata.Get("instance/zone")
	if err != nil {
		return "", "", err
	}
	parts := strings.Split(result, "/")
	if len(parts) != 4 {
		return "", "", fmt.Errorf("unexpected response: %s", result)
	}
	location := parts[3]
	if regional {
		location, err = provider_gce.GetGCERegion(location)
		if err != nil {
			return "", "", err
		}
	}
	projectID, err := metadata.ProjectID()
	if err != nil {
		return "", "", err
	}
	return projectID, location, nil
}

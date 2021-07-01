package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"github.com/urfave/cli/v2"
	"golang.org/x/sync/errgroup"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

const (
	prodcopyPrefix = "gitpod-prodcopy-user"
	prodPrefix     = "gitpod-prod-user"
	project        = "gitpod-191109"
)

// listBuckets lists buckets in the project.
func listBuckets(ctx context.Context, client *storage.Client, w io.Writer, projectID string) (buckets []*storage.BucketAttrs, err error) {
	ctx, cancel := context.WithTimeout(ctx, time.Second*30)
	defer cancel()

	it := client.Buckets(ctx, projectID)
	it.Prefix = prodcopyPrefix
	for {
		battrs, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		// if battrs.Created.Before(time.Now().Add(-24 * time.Hour)) {
		// 	fmt.Fprintf(os.Stderr, "ignoring too old bucket %s\n", battrs.Name)
		// 	continue
		// }

		buckets = append(buckets, battrs)
	}
	return buckets, nil
}

func listContent(ctx context.Context, client *storage.Client, bucket *storage.BucketAttrs, res chan bktobj) {
	objs := client.Bucket(bucket.Name).Objects(ctx, &storage.Query{})
	for {
		obj, err := objs.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			fmt.Fprintf(os.Stderr, "cannot list bucket %s: %v\n", bucket, err)
			continue
		}
		if obj.Created.Before(time.Now().Add(-24 * time.Hour)) {
			fmt.Fprintf(os.Stderr, "ignoring too old obj %s/%s\n", bucket.Name, obj.Name)
			continue
		}
		res <- bktobj{Bucket: bucket, Obj: obj.Name}
	}
}

func checkIfExists(ctx context.Context, client *storage.Client, bucket, obj string) bool {
	fmt.Fprintf(os.Stderr, "checking if %s/%s exists\n", bucket, obj)
	_, err := client.Bucket(bucket).Object(obj).Attrs(ctx)
	return err == nil
}

func copyIfNotExists(ctx context.Context, client *storage.Client, bkt *storage.BucketAttrs, obj string, idx map[string]struct{}) error {
	newBucket := prodPrefix + strings.TrimPrefix(bkt.Name, prodcopyPrefix)
	// if checkIfExists(ctx, client, newBucket, obj) {
	// 	return nil
	// }

	newBucketHDL := client.Bucket(newBucket)
	if _, exists := idx[newBucket]; !exists {
		if _, err := newBucketHDL.Attrs(ctx); err == storage.ErrBucketNotExist {
			fmt.Printf("gsutil mb -p %s -l %s gs://%s\n", project, bkt.Location, newBucket)
		}
		idx[newBucket] = struct{}{}
	}

	fmt.Printf("gsutil cp -n gs://%s/%s gs://%s/%s\n", bkt.Name, obj, newBucket, obj)

	return nil
}

func createBucket(ctx context.Context, name string, hdl *storage.BucketHandle, attrs *storage.BucketAttrs) error {
	fmt.Fprintf(os.Stderr, "create bucket %s\n", name)
	return nil
	// return hdl.Create(ctx, project, attrs)
}

type bktobj struct {
	Bucket *storage.BucketAttrs
	Obj    string
}

func main() {
	app := &cli.App{
		Name: "lifeboad",
		Commands: []*cli.Command{
			{
				Name: "list-objects",
				Action: func(c *cli.Context) error {
					ctx := context.Background()
					client, err := storage.NewClient(ctx, option.WithServiceAccountFile("service-account.json"))
					if err != nil {
						return fmt.Errorf("storage.NewClient: %v", err)
					}
					defer client.Close()

					lst, err := listBuckets(ctx, client, os.Stdout, "gitpod-191109")
					if err != nil {
						return err
					}
					fmt.Fprintf(os.Stderr, "found %d buckets\n", len(lst))

					eg, ctx := errgroup.WithContext(ctx)

					res := make(chan bktobj, 100)
					for _, bkt := range lst {
						bkt := bkt
						eg.Go(func() error {
							listContent(context.Background(), client, bkt, res)
							return nil
						})
					}

					go func() {
						idx := make(map[string]struct{})
						for obj := range res {
							err := copyIfNotExists(ctx, client, obj.Bucket, obj.Obj, idx)
							if err != nil {
								fmt.Fprintf(os.Stderr, "cannot emit copy: %v", err)
							}
						}
					}()

					return eg.Wait()
				},
			},
		},
	}

	err := app.Run(os.Args)
	if err != nil {
		log.Fatal(err)
	}
}

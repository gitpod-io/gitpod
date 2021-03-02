package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	cli "github.com/urfave/cli/v2"
	"golang.org/x/sync/errgroup"
)

func main() {
	app := &cli.App{
		Name: "stream-test",
		Commands: []*cli.Command{
			{
				Name: "minio",
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:     "endpoint",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "access-key",
						Required: true,
					},
					&cli.StringFlag{
						Name:     "secret-key",
						Required: true,
					},
				},
				Action: func(c *cli.Context) error {
					return streamMinio(c.String("endpoint"), c.String("access-key"), c.String("secret-key"))
				},
			},
		},
	}
	app.RunAndExitOnError()
}

const (
	bucketName = "stream-test"
)

func streamMinio(endpoint, accessKey, secretKey string) error {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: false,
	})
	if err != nil {
		return err
	}

	ctx := context.Background()
	if exists, err := client.BucketExists(ctx, bucketName); err != nil {
		return err
	} else if !exists {
		err := client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			return err
		}
	}

	objectName := fmt.Sprintf("obj-%d", time.Now().Unix())

	// The object must exist before the GetObject call. Otherwise that call would fail.
	_, err = client.PutObject(ctx, bucketName, objectName, bytes.NewReader(nil), -1, minio.PutObjectOptions{})
	if err != nil {
		return fmt.Errorf("initial putobj: %w", err)
	}

	cr, cw := io.Pipe()

	wg, ctx := errgroup.WithContext(ctx)
	wg.Go(func() (err error) {
		defer func() {
			if err != nil {
				err = fmt.Errorf("PutObject: %w", err)
			}
		}()

		_, err = client.PutObject(ctx, bucketName, objectName, cr, -1, minio.PutObjectOptions{})
		fmt.Println("put object done")
		return err
	})
	wg.Go(func() (err error) {
		defer func() {
			if err != nil {
				err = fmt.Errorf("GetObject: %w", err)
			}
		}()

		// make sure the PutObject call ran
		time.Sleep(1 * time.Second)

		obj, err := client.GetObject(ctx, bucketName, objectName, minio.GetObjectOptions{})
		if err != nil {
			return err
		}
		defer obj.Close()

		_, err = io.Copy(os.Stdout, obj)
		if err != nil {
			return err
		}

		return nil
	})
	wg.Go(func() error {
		defer cw.Close()
		for i := 0; i < 10; i++ {
			time.Sleep(1 * time.Second)
			cw.Write([]byte(fmt.Sprintf("line %d\n", i)))
			fmt.Printf("wrote line %d\n", i)
		}
		return nil
	})
	return wg.Wait()
}

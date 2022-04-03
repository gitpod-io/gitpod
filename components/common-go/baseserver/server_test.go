package baseserver_test

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"testing"
	"time"
)

func TestServer_WithOptions(t *testing.T) {
	c := make(chan string)
	close(c)

	val, isClosed := <-c
	fmt.Println(val, isClosed)
	val, isClosed = <-c
	fmt.Println(val, isClosed)
	val, isClosed = <-c
	fmt.Println(val, isClosed)

	_, err := baseserver.New("server_name",
		baseserver.WithHTTPPort(9000),
		baseserver.WithGRPCPort(9001),
		baseserver.WithTLS(baseserver.Certs{
			CACertPath:     "",
			ServerCertPath: "",
			ServerKeyPath:  "",
		}),
		baseserver.WithLogger(log.New()),
	)
	if err != nil {
		t.Errorf("failed to construct base server: %s", err)
	}

}

func TestServer(t *testing.T) {
	s, err := baseserver.New("test_server")
	if err != nil {
		t.Errorf("failed to construct base server: %s", err)
	}

	go func() {
		if err := s.ListenAndServe(); err != nil {
			t.Fatal("Server failed to start")
		}
	}()

	time.Sleep(5 * time.Second)

	if err := s.Close(context.Background()); err != nil {
		t.Fatal("failed to shut down server")
	}
}

func TestServer2(t *testing.T) {
	s, err := baseserver.New("test_server")
	if err != nil {
		t.Errorf("failed to construct base server: %s", err)
	}

	go func() {
		if err := s.ListenAndServe(); err != nil {
			t.Fatal("Server failed to start")
		}
	}()

	time.Sleep(5 * time.Second)

	if err := s.Close(context.Background()); err != nil {
		t.Fatal("failed to shut down server")
	}
}

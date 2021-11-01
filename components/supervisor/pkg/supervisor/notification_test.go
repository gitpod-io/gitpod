// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"google.golang.org/grpc"

	"github.com/gitpod-io/gitpod/supervisor/api"
)

type TestNotificationService_SubscribeServer struct {
	resps   chan *api.SubscribeResponse
	context context.Context
	cancel  context.CancelFunc
	slow    bool
	grpc.ServerStream
}

func (subscribeServer *TestNotificationService_SubscribeServer) Send(resp *api.SubscribeResponse) error {
	if subscribeServer.slow {
		select {
		case <-time.After(time.Second):
		case <-subscribeServer.Context().Done():
		}
	}
	subscribeServer.resps <- resp
	return nil
}

func (subscribeServer *TestNotificationService_SubscribeServer) Context() context.Context {
	return subscribeServer.context
}

func NewSubscribeServer() *TestNotificationService_SubscribeServer {
	context, cancel := context.WithCancel(context.Background())
	return &TestNotificationService_SubscribeServer{
		context: context,
		cancel:  cancel,
		resps:   make(chan *api.SubscribeResponse, 1),
	}
}

func Test(t *testing.T) {
	t.Run("Test happy path", func(t *testing.T) {
		notificationService := NewNotificationService()
		subscriber := NewSubscribeServer()
		defer subscriber.cancel()
		go func() {
			notification := <-subscriber.resps
			_, _ = notificationService.Respond(subscriber.context, &api.RespondRequest{
				RequestId: notification.RequestId,
				Response: &api.NotifyResponse{
					Action: notification.Request.Actions[0],
				},
			})
		}()
		go func() {
			err := notificationService.Subscribe(&api.SubscribeRequest{}, subscriber)
			if err != nil {
				t.Errorf("error receiving user action %s", err)
			}
		}()
		notifyResponse, err := notificationService.Notify(subscriber.context, &api.NotifyRequest{
			Level:   api.NotifyRequest_INFO,
			Message: "Do you like this test?",
			Actions: []string{"yes", "no", "cancel"},
		})
		if err != nil {
			t.Errorf("error receiving user action %s", err)
		}
		if notifyResponse.Action != "yes" {
			t.Errorf("expected response 'yes' but was '%s'", notifyResponse.Action)
		}
	})

	t.Run("Notification without actions should return immediately", func(t *testing.T) {
		notificationService := NewNotificationService()
		notifyResponse, err := notificationService.Notify(context.Background(), &api.NotifyRequest{
			Level:   api.NotifyRequest_WARNING,
			Message: "You have been warned...",
		})
		if err != nil {
			t.Errorf("error receiving response %s", err)
		}
		if len(notifyResponse.Action) > 0 {
			t.Errorf("expected no response but got %s", notifyResponse.Action)
		}
	})

	t.Run("Late subscriber and pending notifications", func(t *testing.T) {
		notificationService := NewNotificationService()

		// fire notification without any subscribers
		_, err := notificationService.Notify(context.Background(), &api.NotifyRequest{
			Level:   api.NotifyRequest_INFO,
			Message: "Notification fired before subscription",
		})
		if err != nil {
			t.Errorf("error on notification %s", err)
		}

		// add a first subscriber
		firstSubscriber := NewSubscribeServer()
		defer firstSubscriber.cancel()

		// verify that late subscriber consumes cached notification
		go func() {
			notificationService.Subscribe(&api.SubscribeRequest{}, firstSubscriber)
		}()
		select {
		case _, ok := <-firstSubscriber.resps:
			if !ok {
				t.Errorf("notification stream closed")
			}
		case <-time.After(2 * time.Second):
			t.Errorf("late subscriber did not receive pending notification")
		}

		// add a second subscriber
		secondSubscriber := NewSubscribeServer()
		defer secondSubscriber.cancel()
		go func() {
			notificationService.Subscribe(&api.SubscribeRequest{}, secondSubscriber)
		}()

		// Second subscriber should only get second message
		go func() {
			notificationService.Notify(context.Background(), &api.NotifyRequest{
				Level:   api.NotifyRequest_INFO,
				Message: "Notification fired before subscription",
				Actions: []string{"ok"},
			})
		}()
		go func() {
			// avoid blocking the delivery to the second subscriber
			<-firstSubscriber.resps
		}()
		request2, ok := <-secondSubscriber.resps
		if !ok {
			t.Errorf("notification stream closed")
		}
		if request2.Request.Message != "Notification fired before subscription" {
			t.Errorf("late subscriber received processed notification")
		}
	})

	t.Run("Wrong action is rejected", func(t *testing.T) {
		notificationService := NewNotificationService()

		// fire notification without any subscribers
		go func() {
			_, err := notificationService.Notify(context.Background(), &api.NotifyRequest{
				Level:   api.NotifyRequest_INFO,
				Message: "Notification with actions",
				Actions: []string{"ok"},
			})
			if err != nil {
				t.Errorf("error on notification %s", err)
			}
		}()

		// add a first subscriber
		subscriber := NewSubscribeServer()
		defer subscriber.cancel()
		go func() {
			notificationService.Subscribe(&api.SubscribeRequest{}, subscriber)
		}()

		// receive notification
		subscriptionRequest, ok := <-subscriber.resps
		if !ok {
			t.Errorf("notification stream closed")
		}

		// invalid response
		_, err := notificationService.Respond(context.Background(), &api.RespondRequest{
			RequestId: subscriptionRequest.RequestId,
			Response: &api.NotifyResponse{
				Action: "invalid",
			},
		})
		if err == nil {
			t.Errorf("expected error on invalid response")
		}

		// valid response
		_, err = notificationService.Respond(context.Background(), &api.RespondRequest{
			RequestId: subscriptionRequest.RequestId,
			Response: &api.NotifyResponse{
				Action: "ok",
			},
		})
		if err != nil {
			t.Errorf("error on valid response: %s", err)
		}

		// stale response
		_, err = notificationService.Respond(context.Background(), &api.RespondRequest{
			RequestId: subscriptionRequest.RequestId,
			Response: &api.NotifyResponse{
				Action: "ok",
			},
		})
		if err == nil {
			t.Errorf("expected error on stale response")
		}
	})
	t.Run("Backpressure", func(t *testing.T) {
		notificationService := NewNotificationService()

		subscriber := NewSubscribeServer()
		defer subscriber.cancel()

		// fire initial notifications
		_, err := notificationService.Notify(context.Background(), &api.NotifyRequest{
			Level:   api.NotifyRequest_INFO,
			Message: "Notification 0",
		})
		if err != nil {
			t.Errorf("error on notification %s", err)
		}
		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()
			// consume the first message to be in sync
			<-subscriber.resps
			subscriber.slow = true

			// send messages to stress the subscriber
			for i := 1; i < NotifierMaxPendingNotifications+1; i++ {
				_, err := notificationService.Notify(context.Background(), &api.NotifyRequest{
					Level:   api.NotifyRequest_INFO,
					Message: fmt.Sprintf("Notification %d", i),
				})
				if err != nil {
					t.Errorf("error on notification %s", err)
				}
			}

			// send message to stress the notifier
			_, err := notificationService.Notify(context.Background(), &api.NotifyRequest{
				Level:   api.NotifyRequest_INFO,
				Message: fmt.Sprintf("Notification %d", NotifierMaxPendingNotifications+1),
			})
			if err == nil {
				t.Errorf("Expected error on notifier backpressure")
			}
		}()

		err = notificationService.Subscribe(&api.SubscribeRequest{}, subscriber)
		if err == nil {
			t.Errorf("Expected unresponsive subscriber to be cancelled")
		}
		wg.Wait()
	})
}

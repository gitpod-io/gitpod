package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"

	cv "github.com/nirasan/go-oauth-pkce-code-verifier"
	"github.com/skratchdot/open-golang/open"
	"github.com/spf13/viper"
)

// AuthorizeUser implements the PKCE OAuth2 flow.
func AuthorizeUser(clientID string, authDomain string, redirectURL string) {
	// initialize the code verifier
	var CodeVerifier, _ = cv.CreateCodeVerifier()

	// Create code_challenge with S256 method
	codeChallenge := CodeVerifier.CodeChallengeS256()

	// construct the authorization URL (with Gitpod as the authorization provider)
	authorizationURL := fmt.Sprintf(
		"https://%s/api/local-app/authorize?"+
			"&scope=openid"+
			"&response_type=code&client_id=%s"+
			"&code_challenge=%s"+
			"&code_challenge_method=S256&redirect_uri=%s",
		authDomain, clientID, codeChallenge, redirectURL)

	// start a web server to listen on a callback URL
	server := &http.Server{Addr: redirectURL}

	// define a handler that will get the authorization code, call the token endpoint, and close the HTTP server
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// get the authorization code
		code := r.URL.Query().Get("code")
		if code == "" {
			fmt.Println("snap: Url Param 'code' is missing")
			io.WriteString(w, "Error: could not find 'code' URL parameter\n")

			// close the HTTP server and return
			cleanup(server)
			return
		}

		// trade the authorization code and the code verifier for an access token
		codeVerifier := CodeVerifier.String()
		token, err := getAccessToken(clientID, codeVerifier, code, redirectURL)
		if err != nil {
			fmt.Println("snap: could not get access token")
			io.WriteString(w, "Error: could not retrieve access token\n")

			// close the HTTP server and return
			cleanup(server)
			return
		}

		viper.Set("AccessToken", token)
		err = viper.WriteConfig()
		//_, err = config.WriteConfigFile("auth.json", token)
		if err != nil {
			fmt.Println("snap: could not write config file")
			io.WriteString(w, "Error: could not store access token\n")

			// close the HTTP server and return
			cleanup(server)
			return
		}

		// return an indication of success to the caller
		io.WriteString(w, `
		<html>
			<body>
				<h1>Login successful!</h1>
				<h2>You can close this window and return to the snap CLI.</h2>
			</body>
		</html>`)

		fmt.Println("Successfully logged into snapmaster API.")

		// close the HTTP server
		cleanup(server)
	})

	// parse the redirect URL for the port number
	u, err := url.Parse(redirectURL)
	if err != nil {
		fmt.Printf("snap: bad redirect URL: %s\n", err)
		os.Exit(1)
	}

	// set up a listener on the redirect port
	port := fmt.Sprintf(":%s", u.Port())
	l, err := net.Listen("tcp", port)
	if err != nil {
		fmt.Printf("snap: can't listen to port %s: %s\n", port, err)
		os.Exit(1)
	}

	// open a browser window to the authorizationURL
	err = open.Start(authorizationURL)
	if err != nil {
		fmt.Printf("snap: can't open browser to URL %s: %s\n", authorizationURL, err)
		os.Exit(1)
	}

	// start the blocking web server loop
	// this will exit when the handler gets fired and calls server.Close()
	server.Serve(l)
}

// getAccessToken trades the authorization code retrieved from the first OAuth2 leg for an access token
func getAccessToken(clientID string, codeVerifier string, authorizationCode string, callbackURL string) (string, error) {
	// set the url and form-encoded data for the POST to the access token endpoint
	url := "https://snapmaster-dev.auth0.com/oauth/token"
	data := fmt.Sprintf(
		"grant_type=authorization_code&client_id=%s"+
			"&code_verifier=%s"+
			"&code=%s"+
			"&redirect_uri=%s",
		clientID, codeVerifier, authorizationCode, callbackURL)
	payload := strings.NewReader(data)

	// create the request and execute it
	req, _ := http.NewRequest("POST", url, payload)
	req.Header.Add("content-type", "application/x-www-form-urlencoded")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("snap: HTTP error: %s", err)
		return "", err
	}

	// process the response
	defer res.Body.Close()
	var responseData map[string]interface{}
	body, _ := ioutil.ReadAll(res.Body)

	// unmarshal the json into a string map
	err = json.Unmarshal(body, &responseData)
	if err != nil {
		fmt.Printf("snap: JSON error: %s", err)
		return "", err
	}

	// retrieve the access token out of the map, and return to caller
	accessToken := responseData["access_token"].(string)
	return accessToken, nil
}

// cleanup closes the HTTP server
func cleanup(server *http.Server) {
	// we run this as a goroutine so that this function falls through and
	// the socket to the browser gets flushed/closed before the server goes away
	go server.Close()
}

# We cache the requests to the VSX registry and in case of an upstream server error we serve the the cached results.
https://open-vsx.{{.Domain}} {
    import enable_log_debug
    import remove_server_header
    import ssl_configuration

    # The http_cache plugin does not allow to cache the HTTP OPTIONS method.
    # That's why we simply serve a static respond instead of asking the upstream server.
    @options method OPTIONS
    header @options {
        Access-Control-Allow-Credentials "true"
        Access-Control-Allow-Headers "content-type,x-market-client-id,x-market-user-id,x-client-commit,x-client-name,x-client-version,x-machine-id"
        Access-Control-Allow-Methods "OPTIONS,GET,POST,PATCH,PUT,DELETE"
        Access-Control-Allow-Origin "*"
    }
    respond @options 204 {
        close
    }

    reverse_proxy {
        to https://{{.RepoURL}}

        # health_uri /api/-/search

        header_up Host "{{.RepoURL}}"
        header_up -Connection

        # Override/remove existing cache control headers from the upstream server.
        header_down Cache-Control "max-age=30, public"  # cache for 30 seconds
        header_down -Vary
        header_down -Pragma
        header_down -Expires
    }

    gitpod.body_intercept {
        search "{{.RepoURL}}"
        replace "open-vsx.{{.Domain}}"
    }

    http_cache {
        cache_type file
        path /tmp/openvsx-cache
        match_path /
        match_methods GET HEAD POST
        stale_max_age 72h  # 3 days
        cache_key "{http.request.method} {http.request.host}{http.request.uri.path}?{http.request.uri.query} {http.request.contentlength} {http.request.bodyhash}"
    }
}
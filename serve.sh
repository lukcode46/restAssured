#!/usr/bin/env sh
# Rest Assured has no package dependencies. Serve it on localhost so the service worker can enable offline installation.
python3 -m http.server 8080

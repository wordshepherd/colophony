#!/bin/sh
set -e
# Substitute environment variables in the config template
envsubst < /etc/alertmanager/alertmanager.tmpl.yml > /etc/alertmanager/alertmanager.yml
exec /bin/alertmanager "$@"

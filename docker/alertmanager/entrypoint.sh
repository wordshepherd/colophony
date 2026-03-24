#!/bin/sh
set -e

# Default SLACK_WEBHOOK_URL to a placeholder if not set — AlertManager validates all
# receiver URLs at startup even if the receiver is not used by the active route.
SLACK_URL="${SLACK_WEBHOOK_URL:-https://hooks.slack.com/services/NOT_CONFIGURED}"

# Substitute SLACK_WEBHOOK_URL in the config template using sed
sed "s|\${SLACK_WEBHOOK_URL}|${SLACK_URL}|g" \
  /etc/alertmanager/alertmanager.tmpl.yml > /etc/alertmanager/alertmanager.yml

exec /bin/alertmanager "$@"

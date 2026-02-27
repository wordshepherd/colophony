from enum import Enum

class ListAuditEventsResource(str, Enum):
    API_KEY = "api_key"
    AUDIT = "audit"
    AUTH = "auth"
    CMS_CONNECTION = "cms_connection"
    CONTRACT = "contract"
    CONTRACT_TEMPLATE = "contract_template"
    EMAIL = "email"
    EMBED_TOKEN = "embed_token"
    FEDERATION = "federation"
    FILE = "file"
    FORM = "form"
    HUB = "hub"
    ISSUE = "issue"
    MANUSCRIPT = "manuscript"
    MIGRATION = "migration"
    NOTIFICATION_INBOX = "notification_inbox"
    NOTIFICATION_PREFERENCE = "notification_preference"
    ORGANIZATION = "organization"
    PAYMENT = "payment"
    PERIOD = "period"
    PIPELINE_ITEM = "pipeline_item"
    PUBLICATION = "publication"
    SIMSUB = "simsub"
    SUBMISSION = "submission"
    TRANSFER = "transfer"
    USER = "user"
    WEBHOOK_DELIVERY = "webhook_delivery"
    WEBHOOK_ENDPOINT = "webhook_endpoint"

    def __str__(self) -> str:
        return str(self.value)

from enum import Enum


class ListWebhookEndpointsResponse200ItemsItemStatus(str, Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"

    def __str__(self) -> str:
        return str(self.value)

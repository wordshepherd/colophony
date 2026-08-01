from enum import Enum


class UpdateWebhookEndpointBodyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"

    def __str__(self) -> str:
        return str(self.value)

from enum import Enum


class RetryWebhookDeliveryResponse200Status(str, Enum):
    CANCELLED = "CANCELLED"
    DELIVERED = "DELIVERED"
    DELIVERING = "DELIVERING"
    FAILED = "FAILED"
    QUEUED = "QUEUED"

    def __str__(self) -> str:
        return str(self.value)

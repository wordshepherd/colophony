from enum import Enum


class UpsertNotificationPreferenceResponse200Channel(str, Enum):
    EMAIL = "email"
    IN_APP = "in_app"

    def __str__(self) -> str:
        return str(self.value)

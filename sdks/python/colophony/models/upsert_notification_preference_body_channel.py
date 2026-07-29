from enum import Enum


class UpsertNotificationPreferenceBodyChannel(str, Enum):
    EMAIL = "email"
    IN_APP = "in_app"

    def __str__(self) -> str:
        return str(self.value)

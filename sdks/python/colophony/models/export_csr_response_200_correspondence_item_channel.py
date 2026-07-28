from enum import Enum


class ExportCsrResponse200CorrespondenceItemChannel(str, Enum):
    EMAIL = "email"
    IN_APP = "in_app"
    OTHER = "other"
    PORTAL = "portal"

    def __str__(self) -> str:
        return str(self.value)

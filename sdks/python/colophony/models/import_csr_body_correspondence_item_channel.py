from enum import Enum


class ImportCsrBodyCorrespondenceItemChannel(str, Enum):
    EMAIL = "email"
    IN_APP = "in_app"
    OTHER = "other"
    PORTAL = "portal"

    def __str__(self) -> str:
        return str(self.value)

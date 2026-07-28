from enum import Enum


class ExportCsrResponse200CorrespondenceItemSource(str, Enum):
    COLOPHONY = "colophony"
    MANUAL = "manual"

    def __str__(self) -> str:
        return str(self.value)

from enum import Enum

class GetManuscriptResponse200VersionsItemFilesItemScanStatus(str, Enum):
    CLEAN = "CLEAN"
    FAILED = "FAILED"
    INFECTED = "INFECTED"
    PENDING = "PENDING"
    SCANNING = "SCANNING"

    def __str__(self) -> str:
        return str(self.value)

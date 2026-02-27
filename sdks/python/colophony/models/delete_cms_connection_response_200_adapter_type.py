from enum import Enum

class DeleteCmsConnectionResponse200AdapterType(str, Enum):
    GHOST = "GHOST"
    WORDPRESS = "WORDPRESS"

    def __str__(self) -> str:
        return str(self.value)

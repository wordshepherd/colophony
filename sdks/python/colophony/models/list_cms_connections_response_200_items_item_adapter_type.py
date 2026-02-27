from enum import Enum

class ListCmsConnectionsResponse200ItemsItemAdapterType(str, Enum):
    GHOST = "GHOST"
    WORDPRESS = "WORDPRESS"

    def __str__(self) -> str:
        return str(self.value)

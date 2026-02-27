from enum import Enum

class ListContractTemplatesResponse200ItemsItemMergeFieldsType0ItemSource(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"

    def __str__(self) -> str:
        return str(self.value)

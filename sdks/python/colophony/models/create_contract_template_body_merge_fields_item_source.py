from enum import Enum

class CreateContractTemplateBodyMergeFieldsItemSource(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"

    def __str__(self) -> str:
        return str(self.value)

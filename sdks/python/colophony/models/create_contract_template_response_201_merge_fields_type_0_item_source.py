from enum import Enum

class CreateContractTemplateResponse201MergeFieldsType0ItemSource(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"

    def __str__(self) -> str:
        return str(self.value)

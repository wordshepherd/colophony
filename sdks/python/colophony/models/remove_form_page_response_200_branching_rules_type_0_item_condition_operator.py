from enum import Enum

class RemoveFormPageResponse200BranchingRulesType0ItemConditionOperator(str, Enum):
    AND = "AND"
    OR = "OR"

    def __str__(self) -> str:
        return str(self.value)

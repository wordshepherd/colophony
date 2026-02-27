from enum import Enum

class ReorderFormPagesResponse200ItemBranchingRulesType0ItemConditionOperator(str, Enum):
    AND = "AND"
    OR = "OR"

    def __str__(self) -> str:
        return str(self.value)

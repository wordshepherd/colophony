from enum import Enum

class UpdateFormFieldResponse200ConditionalRulesType0ItemConditionOperator(str, Enum):
    AND = "AND"
    OR = "OR"

    def __str__(self) -> str:
        return str(self.value)

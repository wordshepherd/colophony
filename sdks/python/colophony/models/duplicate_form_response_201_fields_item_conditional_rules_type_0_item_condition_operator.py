from enum import Enum

class DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionOperator(str, Enum):
    AND = "AND"
    OR = "OR"

    def __str__(self) -> str:
        return str(self.value)

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.duplicate_form_response_201_fields_item_conditional_rules_type_0_item_condition_operator import DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionOperator
from typing import cast

if TYPE_CHECKING:
  from ..models.duplicate_form_response_201_fields_item_conditional_rules_type_0_item_condition_rules_item import DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionRulesItem





T = TypeVar("T", bound="DuplicateFormResponse201FieldsItemConditionalRulesType0ItemCondition")



@_attrs_define
class DuplicateFormResponse201FieldsItemConditionalRulesType0ItemCondition:
    """ 
        Attributes:
            operator (DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionOperator):
            rules (list[DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionRulesItem]):
     """

    operator: DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionOperator
    rules: list[DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionRulesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.duplicate_form_response_201_fields_item_conditional_rules_type_0_item_condition_rules_item import DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionRulesItem
        operator = self.operator.value

        rules = []
        for rules_item_data in self.rules:
            rules_item = rules_item_data.to_dict()
            rules.append(rules_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "operator": operator,
            "rules": rules,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.duplicate_form_response_201_fields_item_conditional_rules_type_0_item_condition_rules_item import DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionRulesItem
        d = dict(src_dict)
        operator = DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionOperator(d.pop("operator"))




        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = DuplicateFormResponse201FieldsItemConditionalRulesType0ItemConditionRulesItem.from_dict(rules_item_data)



            rules.append(rules_item)


        duplicate_form_response_201_fields_item_conditional_rules_type_0_item_condition = cls(
            operator=operator,
            rules=rules,
        )


        duplicate_form_response_201_fields_item_conditional_rules_type_0_item_condition.additional_properties = d
        return duplicate_form_response_201_fields_item_conditional_rules_type_0_item_condition

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties

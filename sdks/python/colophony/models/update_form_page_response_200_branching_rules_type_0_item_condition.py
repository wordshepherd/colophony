from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_form_page_response_200_branching_rules_type_0_item_condition_operator import UpdateFormPageResponse200BranchingRulesType0ItemConditionOperator
from typing import cast

if TYPE_CHECKING:
  from ..models.update_form_page_response_200_branching_rules_type_0_item_condition_rules_item import UpdateFormPageResponse200BranchingRulesType0ItemConditionRulesItem





T = TypeVar("T", bound="UpdateFormPageResponse200BranchingRulesType0ItemCondition")



@_attrs_define
class UpdateFormPageResponse200BranchingRulesType0ItemCondition:
    """ 
        Attributes:
            operator (UpdateFormPageResponse200BranchingRulesType0ItemConditionOperator):
            rules (list[UpdateFormPageResponse200BranchingRulesType0ItemConditionRulesItem]):
     """

    operator: UpdateFormPageResponse200BranchingRulesType0ItemConditionOperator
    rules: list[UpdateFormPageResponse200BranchingRulesType0ItemConditionRulesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_form_page_response_200_branching_rules_type_0_item_condition_rules_item import UpdateFormPageResponse200BranchingRulesType0ItemConditionRulesItem
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
        from ..models.update_form_page_response_200_branching_rules_type_0_item_condition_rules_item import UpdateFormPageResponse200BranchingRulesType0ItemConditionRulesItem
        d = dict(src_dict)
        operator = UpdateFormPageResponse200BranchingRulesType0ItemConditionOperator(d.pop("operator"))




        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = UpdateFormPageResponse200BranchingRulesType0ItemConditionRulesItem.from_dict(rules_item_data)



            rules.append(rules_item)


        update_form_page_response_200_branching_rules_type_0_item_condition = cls(
            operator=operator,
            rules=rules,
        )


        update_form_page_response_200_branching_rules_type_0_item_condition.additional_properties = d
        return update_form_page_response_200_branching_rules_type_0_item_condition

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

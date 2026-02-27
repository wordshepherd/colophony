from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.remove_form_field_response_200_conditional_rules_type_0_item_effect import RemoveFormFieldResponse200ConditionalRulesType0ItemEffect
from typing import cast

if TYPE_CHECKING:
  from ..models.remove_form_field_response_200_conditional_rules_type_0_item_condition import RemoveFormFieldResponse200ConditionalRulesType0ItemCondition





T = TypeVar("T", bound="RemoveFormFieldResponse200ConditionalRulesType0Item")



@_attrs_define
class RemoveFormFieldResponse200ConditionalRulesType0Item:
    """ 
        Attributes:
            effect (RemoveFormFieldResponse200ConditionalRulesType0ItemEffect):
            condition (RemoveFormFieldResponse200ConditionalRulesType0ItemCondition):
     """

    effect: RemoveFormFieldResponse200ConditionalRulesType0ItemEffect
    condition: RemoveFormFieldResponse200ConditionalRulesType0ItemCondition
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.remove_form_field_response_200_conditional_rules_type_0_item_condition import RemoveFormFieldResponse200ConditionalRulesType0ItemCondition
        effect = self.effect.value

        condition = self.condition.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "effect": effect,
            "condition": condition,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.remove_form_field_response_200_conditional_rules_type_0_item_condition import RemoveFormFieldResponse200ConditionalRulesType0ItemCondition
        d = dict(src_dict)
        effect = RemoveFormFieldResponse200ConditionalRulesType0ItemEffect(d.pop("effect"))




        condition = RemoveFormFieldResponse200ConditionalRulesType0ItemCondition.from_dict(d.pop("condition"))




        remove_form_field_response_200_conditional_rules_type_0_item = cls(
            effect=effect,
            condition=condition,
        )


        remove_form_field_response_200_conditional_rules_type_0_item.additional_properties = d
        return remove_form_field_response_200_conditional_rules_type_0_item

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

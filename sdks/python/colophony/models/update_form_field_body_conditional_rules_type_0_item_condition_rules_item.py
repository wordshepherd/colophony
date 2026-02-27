from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_form_field_body_conditional_rules_type_0_item_condition_rules_item_comparator import UpdateFormFieldBodyConditionalRulesType0ItemConditionRulesItemComparator
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="UpdateFormFieldBodyConditionalRulesType0ItemConditionRulesItem")



@_attrs_define
class UpdateFormFieldBodyConditionalRulesType0ItemConditionRulesItem:
    """ 
        Attributes:
            field (str):
            comparator (UpdateFormFieldBodyConditionalRulesType0ItemConditionRulesItemComparator):
            value (bool | float | list[str] | str | Unset):
     """

    field: str
    comparator: UpdateFormFieldBodyConditionalRulesType0ItemConditionRulesItemComparator
    value: bool | float | list[str] | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        field = self.field

        comparator = self.comparator.value

        value: bool | float | list[str] | str | Unset
        if isinstance(self.value, Unset):
            value = UNSET
        elif isinstance(self.value, list):
            value = self.value


        else:
            value = self.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "field": field,
            "comparator": comparator,
        })
        if value is not UNSET:
            field_dict["value"] = value

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        field = d.pop("field")

        comparator = UpdateFormFieldBodyConditionalRulesType0ItemConditionRulesItemComparator(d.pop("comparator"))




        def _parse_value(data: object) -> bool | float | list[str] | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                value_type_3 = cast(list[str], data)

                return value_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(bool | float | list[str] | str | Unset, data)

        value = _parse_value(d.pop("value", UNSET))


        update_form_field_body_conditional_rules_type_0_item_condition_rules_item = cls(
            field=field,
            comparator=comparator,
            value=value,
        )


        update_form_field_body_conditional_rules_type_0_item_condition_rules_item.additional_properties = d
        return update_form_field_body_conditional_rules_type_0_item_condition_rules_item

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

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.reorder_form_pages_response_200_item_branching_rules_type_0_item_condition import ReorderFormPagesResponse200ItemBranchingRulesType0ItemCondition





T = TypeVar("T", bound="ReorderFormPagesResponse200ItemBranchingRulesType0Item")



@_attrs_define
class ReorderFormPagesResponse200ItemBranchingRulesType0Item:
    """ 
        Attributes:
            target_page_id (UUID):
            condition (ReorderFormPagesResponse200ItemBranchingRulesType0ItemCondition):
     """

    target_page_id: UUID
    condition: ReorderFormPagesResponse200ItemBranchingRulesType0ItemCondition
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.reorder_form_pages_response_200_item_branching_rules_type_0_item_condition import ReorderFormPagesResponse200ItemBranchingRulesType0ItemCondition
        target_page_id = str(self.target_page_id)

        condition = self.condition.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "targetPageId": target_page_id,
            "condition": condition,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.reorder_form_pages_response_200_item_branching_rules_type_0_item_condition import ReorderFormPagesResponse200ItemBranchingRulesType0ItemCondition
        d = dict(src_dict)
        target_page_id = UUID(d.pop("targetPageId"))




        condition = ReorderFormPagesResponse200ItemBranchingRulesType0ItemCondition.from_dict(d.pop("condition"))




        reorder_form_pages_response_200_item_branching_rules_type_0_item = cls(
            target_page_id=target_page_id,
            condition=condition,
        )


        reorder_form_pages_response_200_item_branching_rules_type_0_item.additional_properties = d
        return reorder_form_pages_response_200_item_branching_rules_type_0_item

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

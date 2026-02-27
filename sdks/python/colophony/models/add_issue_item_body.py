from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from uuid import UUID






T = TypeVar("T", bound="AddIssueItemBody")



@_attrs_define
class AddIssueItemBody:
    """ 
        Attributes:
            pipeline_item_id (UUID): Pipeline item to add
            issue_section_id (UUID | Unset): Section to place item in
            sort_order (int | Unset): Sort order within section
     """

    pipeline_item_id: UUID
    issue_section_id: UUID | Unset = UNSET
    sort_order: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        pipeline_item_id = str(self.pipeline_item_id)

        issue_section_id: str | Unset = UNSET
        if not isinstance(self.issue_section_id, Unset):
            issue_section_id = str(self.issue_section_id)

        sort_order = self.sort_order


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "pipelineItemId": pipeline_item_id,
        })
        if issue_section_id is not UNSET:
            field_dict["issueSectionId"] = issue_section_id
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        pipeline_item_id = UUID(d.pop("pipelineItemId"))




        _issue_section_id = d.pop("issueSectionId", UNSET)
        issue_section_id: UUID | Unset
        if isinstance(_issue_section_id,  Unset):
            issue_section_id = UNSET
        else:
            issue_section_id = UUID(_issue_section_id)




        sort_order = d.pop("sortOrder", UNSET)

        add_issue_item_body = cls(
            pipeline_item_id=pipeline_item_id,
            issue_section_id=issue_section_id,
            sort_order=sort_order,
        )


        add_issue_item_body.additional_properties = d
        return add_issue_item_body

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

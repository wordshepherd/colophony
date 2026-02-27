from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="GetIssueSectionsResponse200Item")



@_attrs_define
class GetIssueSectionsResponse200Item:
    """ 
        Attributes:
            id (UUID): Section ID
            issue_id (UUID): Issue ID
            title (str): Section title
            sort_order (int): Sort order
            created_at (datetime.datetime): When the section was created
     """

    id: UUID
    issue_id: UUID
    title: str
    sort_order: int
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        issue_id = str(self.issue_id)

        title = self.title

        sort_order = self.sort_order

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "issueId": issue_id,
            "title": title,
            "sortOrder": sort_order,
            "createdAt": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        issue_id = UUID(d.pop("issueId"))




        title = d.pop("title")

        sort_order = d.pop("sortOrder")

        created_at = isoparse(d.pop("createdAt"))




        get_issue_sections_response_200_item = cls(
            id=id,
            issue_id=issue_id,
            title=title,
            sort_order=sort_order,
            created_at=created_at,
        )


        get_issue_sections_response_200_item.additional_properties = d
        return get_issue_sections_response_200_item

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

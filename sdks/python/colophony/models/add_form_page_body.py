from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="AddFormPageBody")



@_attrs_define
class AddFormPageBody:
    """ 
        Attributes:
            title (str):
            description (str | Unset):
            sort_order (int | Unset):
     """

    title: str
    description: str | Unset = UNSET
    sort_order: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        title = self.title

        description = self.description

        sort_order = self.sort_order


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "title": title,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if sort_order is not UNSET:
            field_dict["sortOrder"] = sort_order

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        title = d.pop("title")

        description = d.pop("description", UNSET)

        sort_order = d.pop("sortOrder", UNSET)

        add_form_page_body = cls(
            title=title,
            description=description,
            sort_order=sort_order,
        )


        add_form_page_body.additional_properties = d
        return add_form_page_body

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

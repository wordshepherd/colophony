from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ReorderFormPagesBody")



@_attrs_define
class ReorderFormPagesBody:
    """ 
        Attributes:
            page_ids (list[UUID]):
     """

    page_ids: list[UUID]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        page_ids = []
        for page_ids_item_data in self.page_ids:
            page_ids_item = str(page_ids_item_data)
            page_ids.append(page_ids_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "pageIds": page_ids,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        page_ids = []
        _page_ids = d.pop("pageIds")
        for page_ids_item_data in (_page_ids):
            page_ids_item = UUID(page_ids_item_data)



            page_ids.append(page_ids_item)


        reorder_form_pages_body = cls(
            page_ids=page_ids,
        )


        reorder_form_pages_body.additional_properties = d
        return reorder_form_pages_body

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

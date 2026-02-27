from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_manuscripts_response_200_items_item import ListManuscriptsResponse200ItemsItem





T = TypeVar("T", bound="ListManuscriptsResponse200")



@_attrs_define
class ListManuscriptsResponse200:
    """ 
        Attributes:
            items (list[ListManuscriptsResponse200ItemsItem]): Items on the current page
            total (float): Total number of items across all pages
            page (float): Current page number
            limit (float): Items per page
            total_pages (float): Total number of pages
     """

    items: list[ListManuscriptsResponse200ItemsItem]
    total: float
    page: float
    limit: float
    total_pages: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_manuscripts_response_200_items_item import ListManuscriptsResponse200ItemsItem
        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)



        total = self.total

        page = self.page

        limit = self.limit

        total_pages = self.total_pages


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": total_pages,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_manuscripts_response_200_items_item import ListManuscriptsResponse200ItemsItem
        d = dict(src_dict)
        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = ListManuscriptsResponse200ItemsItem.from_dict(items_item_data)



            items.append(items_item)


        total = d.pop("total")

        page = d.pop("page")

        limit = d.pop("limit")

        total_pages = d.pop("totalPages")

        list_manuscripts_response_200 = cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )


        list_manuscripts_response_200.additional_properties = d
        return list_manuscripts_response_200

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

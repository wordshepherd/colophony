from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="ReorderFormFieldsBody")



@_attrs_define
class ReorderFormFieldsBody:
    """ 
        Attributes:
            field_ids (list[UUID]): Ordered list of field IDs
     """

    field_ids: list[UUID]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        field_ids = []
        for field_ids_item_data in self.field_ids:
            field_ids_item = str(field_ids_item_data)
            field_ids.append(field_ids_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "fieldIds": field_ids,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        field_ids = []
        _field_ids = d.pop("fieldIds")
        for field_ids_item_data in (_field_ids):
            field_ids_item = UUID(field_ids_item_data)



            field_ids.append(field_ids_item)


        reorder_form_fields_body = cls(
            field_ids=field_ids,
        )


        reorder_form_fields_body.additional_properties = d
        return reorder_form_fields_body

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

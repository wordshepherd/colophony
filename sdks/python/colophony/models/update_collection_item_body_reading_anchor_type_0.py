from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="UpdateCollectionItemBodyReadingAnchorType0")


@_attrs_define
class UpdateCollectionItemBodyReadingAnchorType0:
    """Content-anchored reading position in ProseMirror document

    Attributes:
        node_index (int):
        char_offset (int):
    """

    node_index: int
    char_offset: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        node_index = self.node_index

        char_offset = self.char_offset

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "nodeIndex": node_index,
                "charOffset": char_offset,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        node_index = d.pop("nodeIndex")

        char_offset = d.pop("charOffset")

        update_collection_item_body_reading_anchor_type_0 = cls(
            node_index=node_index,
            char_offset=char_offset,
        )

        update_collection_item_body_reading_anchor_type_0.additional_properties = d
        return update_collection_item_body_reading_anchor_type_0

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

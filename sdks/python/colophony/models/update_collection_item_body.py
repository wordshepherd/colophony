from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.update_collection_item_body_reading_anchor_type_0 import UpdateCollectionItemBodyReadingAnchorType0


T = TypeVar("T", bound="UpdateCollectionItemBody")


@_attrs_define
class UpdateCollectionItemBody:
    """
    Attributes:
        notes (None | str | Unset): Private notes
        color (None | str | Unset): Label color
        icon (None | str | Unset): Item icon
        reading_anchor (None | Unset | UpdateCollectionItemBodyReadingAnchorType0): Reading position anchor — persisted
            only in collection context
    """

    notes: None | str | Unset = UNSET
    color: None | str | Unset = UNSET
    icon: None | str | Unset = UNSET
    reading_anchor: None | Unset | UpdateCollectionItemBodyReadingAnchorType0 = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.update_collection_item_body_reading_anchor_type_0 import (
            UpdateCollectionItemBodyReadingAnchorType0,
        )

        notes: None | str | Unset
        if isinstance(self.notes, Unset):
            notes = UNSET
        else:
            notes = self.notes

        color: None | str | Unset
        if isinstance(self.color, Unset):
            color = UNSET
        else:
            color = self.color

        icon: None | str | Unset
        if isinstance(self.icon, Unset):
            icon = UNSET
        else:
            icon = self.icon

        reading_anchor: dict[str, Any] | None | Unset
        if isinstance(self.reading_anchor, Unset):
            reading_anchor = UNSET
        elif isinstance(self.reading_anchor, UpdateCollectionItemBodyReadingAnchorType0):
            reading_anchor = self.reading_anchor.to_dict()
        else:
            reading_anchor = self.reading_anchor

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if notes is not UNSET:
            field_dict["notes"] = notes
        if color is not UNSET:
            field_dict["color"] = color
        if icon is not UNSET:
            field_dict["icon"] = icon
        if reading_anchor is not UNSET:
            field_dict["readingAnchor"] = reading_anchor

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_collection_item_body_reading_anchor_type_0 import (
            UpdateCollectionItemBodyReadingAnchorType0,
        )

        d = dict(src_dict)

        def _parse_notes(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        notes = _parse_notes(d.pop("notes", UNSET))

        def _parse_color(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        color = _parse_color(d.pop("color", UNSET))

        def _parse_icon(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        icon = _parse_icon(d.pop("icon", UNSET))

        def _parse_reading_anchor(data: object) -> None | Unset | UpdateCollectionItemBodyReadingAnchorType0:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                reading_anchor_type_0 = UpdateCollectionItemBodyReadingAnchorType0.from_dict(data)

                return reading_anchor_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UpdateCollectionItemBodyReadingAnchorType0, data)

        reading_anchor = _parse_reading_anchor(d.pop("readingAnchor", UNSET))

        update_collection_item_body = cls(
            notes=notes,
            color=color,
            icon=icon,
            reading_anchor=reading_anchor,
        )

        update_collection_item_body.additional_properties = d
        return update_collection_item_body

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
